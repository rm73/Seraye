import { handleApi } from "../../server/handle.mjs";

export default function handler(req, res) {
  return handleApi(req, res, "/api/admin/mocks");
}
