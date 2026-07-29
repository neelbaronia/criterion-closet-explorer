import worker from "../dist/server/index.js";

const vercelHandler = {
  async fetch(request, context) {
    const executionContext = {
      passThroughOnException() {},
      waitUntil(promise) {
        context.waitUntil(promise);
      },
    };

    return worker.fetch(request, {}, executionContext);
  },
};

export default vercelHandler;
