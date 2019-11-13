const uuidBase62 = require('uuid-base62');

module.exports = async function login(
  db,
  ctx,
  provider,
  dbField,
  dbValue,
  authFields,
  authValues,
  name0,
  email0,
  lat0,
  lon0,
) {
  let [user] = await db.query(
    `SELECT id, name, email, isAdmin, lat, lon, settings, osmId, facebookUserId, googleUserId FROM user WHERE ${dbField} = ?`,
    [dbValue],
  );

  if (user) {
    user.pairedWith = [
      user.osmId && 'osm',
      user.facebookUserId && 'facebook',
      user.googleUserId && 'google',
    ].filter(x => x);
  }

  const now = new Date();

  let userId;
  let name;
  let email;
  let isAdmin;
  let lat;
  let lon;
  let settings;
  let preventTips;
  let pairedWith;

  const authUser = ctx.state.user;

  if (user) {
    if (authUser) {
      // pairing + merging

      // TODO transaction

      await db.query('UPDATE picture SET userId = ? WHERE userId = ?', [
        authUser.id,
        user.id,
      ]);

      await db.query('UPDATE pictureComment SET userId = ? WHERE userId = ?', [
        authUser.id,
        user.id,
      ]);

      await db.query(
        'UPDATE pictureRating pr1 SET stars = (SELECT AVG(stars) FROM pictureRating pr2 WHERE pr1.pictureId = pr2.pictureId AND (pr2.userId = ? OR pr2.userId = ?)) WHERE userId = ?',
        [authUser.id, user.id, authUser.id],
      );

      await db.query('DELETE FROM pictureRating WHERE userId = ?', [user.id]);

      await db.query('UPDATE trackingDevice SET userId = ? WHERE userId = ?', [
        authUser.id,
        user.id,
      ]);

      await db.query('DELETE FROM user WHERE userId = ?', [user.id]);

      // TODO consider both user and authUser
      ({ name, email, lat, lon } = user);
      settings = JSON.parse(user.settings);
      userId = user.id;
      isAdmin = !!user.isAdmin;
      preventTips = !!user.preventTips;
      pairedWith = [...user.pairedWith, ...authUser.pairedWith];

      // TODO merge vendor tokens
      await db.query(
        `UPDATE user SET ${dbField} = ?, name = ?, email = ?, lat = ?, lon = ?, ${q} WHERE id = ?`,
        [dbValue, name, email, lat, lon, ...authValues, authUser.id],
      );
    } else {
      // log-in existing

      ({ name, email, lat, lon } = user);
      settings = JSON.parse(user.settings);
      userId = user.id;
      isAdmin = !!user.isAdmin;
      preventTips = !!user.preventTips;
      pairedWith = user.pairedWith;
    }
  } else if (authUser) {
    // pairing

    settings = authUser.settings || {};
    lat = authUser.lat || lat0 || settings.lat;
    lon = authUser.lon || lon0 || settings.lon;
    name = authUser.name || name0;
    email = authUser.email || email0;
    isAdmin = authUser.isAdmin;
    preventTips = authUser.preventTips;
    pairedWith = [provider, ...authUser.pairedWith];

    const q = authFields
      .split(',')
      .map(authField => `${authField} = ?`)
      .join(',');

    // TODO merge vendor tokens
    await db.query(
      `UPDATE user SET ${dbField} = ?, name = ?, email = ?, lat = ?, lon = ?, ${q} WHERE id = ?`,
      [dbValue, name, email, lat, lon, ...authValues, authUser.id],
    );
  } else {
    // create new and log-in
    settings = ctx.request.body.settings || {};
    lat = lat0 || settings.lat;
    lon = lon0 || settings.lon;
    name = name0;
    email = email0;
    isAdmin = false;
    preventTips = false;
    pairedWith = [provider];

    const q = authFields.replace(/\w+/g, '?');

    userId = (await db.query(
      `INSERT INTO user (${dbField}, name, email, createdAt, lat, lon, settings, ${authFields})
        VALUES (?, ?, ?, ?, ?, ?, ?, ${q}})`,
      [
        dbValue,
        name,
        email,
        now,
        lat,
        lon,
        JSON.stringify(settings),
        ...authValues,
      ],
    )).insertId;
  }

  const authToken = authUser ? authUser.authToken : uuidBase62.v4(); // TODO rather some crypro securerandom

  if (!authUser) {
    await db.query(
      `INSERT INTO auth (userId, createdAt, authToken) VALUES (?, ?, ?)`,
      [userId, now, authToken],
    );
  }

  ctx.body = {
    id: userId,
    authToken,
    name,
    email,
    isAdmin,
    lat,
    lon,
    settings,
    preventTips,
    pairedWith,
  };
};
