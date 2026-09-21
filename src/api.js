import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("fmc_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const imgUrl = (u) =>
  u ? (u.startsWith("http") ? u : `${process.env.REACT_APP_BACKEND_URL}${u}`) : null;

export const fmtErr = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.message || "Something went wrong";
};

export default api;
