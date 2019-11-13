const { dbMiddleware } = require('~/database');
const fb = require('~/fb');
const authenticator = require('~/authenticator');

const login = require('./loginProcessor');

module.exports = function attachLoginWithFacebookHandler(router) {
  router.post(
    '/login-fb',
    // TODO validation
    dbMiddleware(),
    authenticator(false /*, true*/),
    async ctx => {
      const { accessToken } = ctx.request.body;

      const { id, name, email } = await fb
        .withAccessToken(accessToken)
        .api('/me', { fields: 'id,name,email' });

      await login(
        ctx.state.db,
        ctx,
        'facebook',
        'facebookUserId',
        id,
        'facebookAccessToken',
        [accessToken],
        name,
        email,
        undefined,
        undefined,
      );
    },
  );
};
