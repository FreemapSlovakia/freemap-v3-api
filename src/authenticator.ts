import { Middleware } from 'koa';

import { SQL } from 'sql-template-strings';
import rp from 'request-promise-native';
import config from 'config';
import { fb } from './fb';
import { googleClient } from './google';

const consumerKey = config.get('oauth.consumerKey') as string;
const consumerSecret = config.get('oauth.consumerSecret') as string;

export function authenticator(require?: boolean, deep?: boolean): Middleware {
  return async function authorize(ctx, next) {
    let { authToken } = ctx.query; // used in websockets

    if (!authToken) {
      const ah = ctx.get('Authorization');

      const m = /^bearer (.+)$/i.exec(ah || '');

      if (!m) {
        if (require) {
          ctx.set(
            'WWW-Authenticate',
            'Bearer realm="freemap"; error="missing token"',
          );

          ctx.throw(401);
        }

        await next();

        return;
      }

      authToken = m[1];
    }

    const [auth] = await ctx.state.db.query(SQL`
      SELECT userId, osmAuthToken, osmAuthTokenSecret, facebookAccessToken, googleIdToken, name, email, isAdmin, lat, lon, settings, preventTips
        FROM auth INNER JOIN user ON (userId = id) WHERE authToken = ${authToken}
    `);

    if (!auth) {
      await bad('');
      return;
    }

    const user = {
      id: auth.userId,
      isAdmin: !!auth.isAdmin,
      name: auth.name,
      authToken,
      lat: auth.lat,
      lon: auth.lon,
      email: auth.email,
      settings: JSON.parse(auth.settings),
      preventTips: !!auth.preventTips,
    };

    if (!deep) {
      ctx.state.user = user;
      await next();
    } else if (auth.googleIdToken) {
      try {
        await googleClient.verifyIdToken({
          idToken: auth.googleIdToken,
          audience: 'not-a-real-client-id',
        });
      } catch (e) {
        await bad('Google');
        return;
      }

      ctx.state.user = user;
      await next();
    } else if (auth.facebookAccessToken) {
      try {
        await fb
          .withAccessToken(auth.facebookAccessToken)
          .api('/me', { fields: 'id' });
      } catch (e) {
        await bad('Facebook');
        return;
      }

      ctx.state.user = user;
      await next();
    } else if (auth.osmAuthToken) {
      try {
        await rp.get({
          url: 'https://api.openstreetmap.org/api/0.6/user/details',
          oauth: {
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            token: auth.osmAuthToken,
            token_secret: auth.osmAuthTokenSecret,
          },
        });
      } catch (e) {
        if (e.name === 'StatusCodeError' && e.statusCode === 401) {
          await bad('OSM');
          return;
        }
      }

      ctx.state.user = user;
      await next();
    }

    async function bad(what: string) {
      await ctx.state.db.query(
        SQL`DELETE FROM auth WHERE authToken = ${authToken}`,
      );

      if (require) {
        ctx.set(
          'WWW-Authenticate',
          `Bearer realm="freemap"; error="invalid ${what} authorization"`,
        );

        ctx.throw(401);
      }

      await next();
    }
  };
}