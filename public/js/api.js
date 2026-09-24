// Cliente HTTP da interface: centraliza chamadas à API e o token JWT.
(function () {
  const TOKEN_KEY = "easyfood.token";
  const USER_KEY = "easyfood.user";

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* navegação privada: segue só em memória */
    }
  }

  const session = {
    token: readStorage(TOKEN_KEY),
    user: JSON.parse(readStorage(USER_KEY) || "null")
  };

  function setSession(token, user) {
    session.token = token;
    session.user = user;
    writeStorage(TOKEN_KEY, token);
    writeStorage(USER_KEY, user ? JSON.stringify(user) : null);
  }

  async function request(method, path, body) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (session.token) headers.Authorization = `Bearer ${session.token}`;

    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Token expirado: limpa a sessão para o usuário entrar de novo
      if (response.status === 401 && session.token) setSession(null, null);
      const message = data?.details?.length ? data.details.join(" · ") : data?.error;
      const error = new Error(message || `Erro ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  window.api = {
    session,
    setSession,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body ?? {}),
    patch: (path, body) => request("PATCH", path, body ?? {}),
    del: (path) => request("DELETE", path)
  };
})();
