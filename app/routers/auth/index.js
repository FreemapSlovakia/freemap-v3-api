const Router = require('koa-router');

const attachLoginWithOsmHandler = require('~/routers/auth/loginWithOsmHandler');
const attachLoginWithOsm2Handler = require('~/routers/auth/loginWithOsm2Handler');
const attachLoginWithFacebookHandler = require('~/routers/auth/loginWithFacebookHandler');
const attachLoginWithGoogleHandler = require('~/routers/auth/loginWithGoogleHandler');
const attachLogoutHandler = require('~/routers/auth/logoutHandler');
const attachValidateHandler = require('~/routers/auth/validateHandler');
const attachPatchUserHandler = require('~/routers/auth/patchUserHandler');

const router = new Router();

attachLoginWithOsmHandler(router);
attachLoginWithOsm2Handler(router);
attachLoginWithFacebookHandler(router);
attachLoginWithGoogleHandler(router);
attachLogoutHandler(router);
attachValidateHandler(router);
attachPatchUserHandler(router);

module.exports = router;
