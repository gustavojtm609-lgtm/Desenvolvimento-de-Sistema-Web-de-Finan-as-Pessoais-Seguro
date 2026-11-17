const { z } = require("../lib/schemas");
function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    req.input = {
      body: body ? body.parse(req.body) : undefined,
      query: query ? query.parse(req.query) : undefined,
      params: params ? params.parse(req.params) : undefined,
    };
    next();
  };
}
const noBody = z.object({}).strict();
module.exports = { validate, noBody };
