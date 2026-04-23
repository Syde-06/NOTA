
export const SUPABASE_URL = "https://vfbhliljrxkyjxxhfjep.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmYmhsaWxqcnhreWp4eGhmamVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDQzODUsImV4cCI6MjA4ODk4MDM4NX0.9egrWItvdc1LAbOWyxyz2S8Gp5NvmUuAxujazGFqaEg";

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
});

// Builds a chainable query that fires only at terminal methods
function buildQuery(table) {
  const state = {
    selectedCols: "*",
    filters: [],       // [{ column, value }]
    method: "GET",
    body: null,
    preferHeader: null,
  };

  const getUrl = () => {
    const params = new URLSearchParams();
    state.filters.forEach(({ column, value }) =>
      params.append(column, `eq.${encodeURIComponent(value)}`)
    );
    if (state.selectedCols !== "*") {
      params.append("select", state.selectedCols);
    }
    const qs = params.toString();
    return `${SUPABASE_URL}/rest/v1/${table}${qs ? "?" + qs : ""}`;
  };

  const run = async () => {
    const token = supabase._session?.access_token;
    const headers = { ...authHeaders(token) };
    if (state.preferHeader) headers["Prefer"] = state.preferHeader;

    const res = await fetch(getUrl(), {
      method: state.method,
      headers,
      body: state.body ? JSON.stringify(state.body) : undefined,
    });
    const json = await res.json();
    if (!res.ok)
      return { data: null, error: { message: json[0]?.message || json.message || "Query failed" } };
    return { data: json, error: null };
  };

  const builder = {
    select(cols = "*") {
      state.selectedCols = cols;
      return builder;          // chainable
    },
    eq(column, value) {
      state.filters.push({ column, value });
      return builder;          // chainable
    },
    // Terminal: returns first row or null
    async single() {
      const { data, error } = await run();
      if (error) return { data: null, error };
      return { data: data[0] ?? null, error: null };
    },
    // Terminal: same but no error if row missing
    async maybeSingle() {
      const { data, error } = await run();
      if (error) return { data: null, error };
      return { data: data[0] ?? null, error: null };
    },
    // Terminal: update rows matching current filters
    async update(row) {
      state.method = "PATCH";
      state.body = row;
      state.preferHeader = "return=representation";
      return run();
    },
    // Terminal: upsert
    async upsert(row) {
      state.method = "POST";
      state.body = row;
      state.preferHeader = "resolution=merge-duplicates,return=representation";
      return run();
    },
    // Terminal: fetch all rows (no .single())
    then(resolve, reject) {
      return run().then(resolve, reject);  // makes `await supabase.from(...).select(...)` work
    },
  };

  return builder;
}

export const supabase = {
  _session: null,

  auth: {
    signUp: async ({ email, password, options }) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ email, password, data: options?.data || {} }),
        });
        const json = await res.json();
        if (!res.ok)
          return { data: null, error: { message: json.msg || json.error_description || "Sign up failed" } };
        return { data: { user: json.user ?? json }, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },

    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok)
          return { data: null, error: { message: json.error_description || json.msg || "Sign in failed" } };
        supabase._session = json;
        return { data: { user: json.user, session: json }, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    },

    signOut: async () => {
      supabase._session = null;
      return { error: null };
    },

    getSession: () => ({
      data: { session: supabase._session || null },
    }),
  },

  from: (table) => buildQuery(table),
};