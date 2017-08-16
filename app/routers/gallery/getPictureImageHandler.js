const fs = require('fs');
const { promisify } = require('util');
const calculate = require('etag');
const { dbMiddleware } = require('~/database');
const { acceptValidator } = require('~/requestValidators');

const statSync = promisify(fs.stat);

module.exports = function attachGetPictureHandler(router) {
  router.get(
    '/pictures/:id/image',
    acceptValidator('image/jpeg'),
    dbMiddleware,
    async (ctx) => {
      const rows = await ctx.state.db.query(
        'SELECT pathname FROM picture WHERE picture.id = ?',
        [ctx.params.id],
      );

      const pathname = `${global.rootDir}/user_data/pictures/${rows[0].pathname}`;

      if (rows.length) {
        const stats = await statSync(pathname);
        ctx.status = 200;
        ctx.response.lastModified = stats.mtime;
        ctx.response.length = stats.size;
        ctx.response.etag = calculate(stats, {
          weak: true,
        });
        ctx.type = 'image/jpeg';
        if (ctx.fresh) {
          ctx.status = 304;
        } else {
          ctx.body = fs.createReadStream(pathname);
        }
      } else {
        ctx.status = 404;
      }
    },
  );
};
