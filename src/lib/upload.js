import axios from "axios";

export async function uploadFile(file, onProgress) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await axios.post(
    `${process.env.REACT_APP_BACKEND_URL}/api/upload`, fd,
    {
      headers: { Authorization: `Bearer ${localStorage.getItem("fmc_token")}` },
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }
  );
  return data; // { url, type }
}