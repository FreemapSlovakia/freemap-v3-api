const { dbMiddleware } = require('~/database');
const authenticator = require('~/authenticator');

module.exports = function attachValidateHandler(router) {
  router.post(
    '/validate',
    dbMiddleware(),
    authenticator(true /*, true*/),
    async ctx => {
      ctx.body = ctx.state.user;
    },
  );
};
