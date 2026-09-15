const apiHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const apiProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const baseUrl = import.meta.env.VITE_API_URL || `${apiProtocol}//${apiHost}:5001/api`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Request failed (${response.status}).`);
  return body;
}

export const api = {
  users: { list: () => request("/users"), create: data => request("/users", { method: "POST", body: JSON.stringify(data) }), update: data => request(`/users/${data.id}`, { method: "PUT", body: JSON.stringify(data) }), remove: id => request(`/users/${id}`, { method: "DELETE" }) },
  qrClients: { list: () => request("/qr-clients"), create: data => request("/qr-clients", { method: "POST", body: JSON.stringify(data) }), remove: id => request(`/qr-clients/${id}`, { method: "DELETE" }) },
  eResources: {
    list: (activeOnly = false) => request(`/e-resources${activeOnly ? "?activeOnly=true" : ""}`),
    create: data => request("/e-resources", { method: "POST", body: JSON.stringify(data) }),
    update: data => request(`/e-resources/${data.id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: id => request(`/e-resources/${id}`, { method: "DELETE" }),
  },
  logs: { list: () => request("/visit-logs"), create: data => request("/visit-logs", { method: "POST", body: JSON.stringify(data) }), update: data => request(`/visit-logs/${data.id}`, { method: "PUT", body: JSON.stringify(data) }), checkout: id => request(`/visit-logs/${id}/checkout`, { method: "PUT" }), clear: () => request("/visit-logs", { method: "DELETE" }) },
  reservations: { list: () => request("/reservations"), create: data => request("/reservations", { method: "POST", body: JSON.stringify(data) }), update: data => request(`/reservations/${data.id}`, { method: "PUT", body: JSON.stringify(data) }), remove: id => request(`/reservations/${id}`, { method: "DELETE" }) },
  blockedDays: { list: () => request("/blocked-days"), create: data => request("/blocked-days", { method: "POST", body: JSON.stringify(data) }), update: data => request(`/blocked-days/${data.date}`, { method: "PUT", body: JSON.stringify(data) }), remove: date => request(`/blocked-days/${date}`, { method: "DELETE" }) },
  settings: {
    get: () => request("/settings"),
    update: data => request("/settings", { method: "PUT", body: JSON.stringify(data) }),
    addInstitution: name => request("/settings/institutions", { method: "POST", body: JSON.stringify({ name }) }),
    removeInstitution: idOrName => request(`/settings/institutions/${encodeURIComponent(idOrName)}`, { method: "DELETE" }),
    addPatronType: name => request("/settings/patron-types", { method: "POST", body: JSON.stringify({ name }) }),
    removePatronType: idOrName => request(`/settings/patron-types/${encodeURIComponent(idOrName)}`, { method: "DELETE" }),
    removeRoom: idOrName => request(`/settings/rooms/${encodeURIComponent(idOrName)}`, { method: "DELETE" }),
  },
  login: (username, password, portal) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password, portal }) }),
};
