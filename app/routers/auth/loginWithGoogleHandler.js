const { dbMiddleware } = require('~/database');
const client = require('~/google');
const authenticator = require('~/authenticator');

const login = require('./loginProcessor');

module.exports = function attachLoginWithFacebookHandler(router) {
  router.post(
    '/login-google',
    // TODO validation
    dbMiddleware(),
    authenticator(false /*, true*/),
    async ctx => {
      const { idToken } = ctx.request.body;

      const { sub, name, email } = (await client.verifyIdToken({
        idToken,
      })).getPayload(); // TODO catch error

      await login(
        ctx.state.db,
        ctx,
        'google',
        'googleUserId',
        sub,
        'googleIdToken',
        [idToken],
        name,
        email,
        undefined,
        undefined,
      );
    },
  );
};
