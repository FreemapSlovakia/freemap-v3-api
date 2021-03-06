import { SQL } from 'sql-template-strings';
import * as ws from 'ws';
import { trackRegister } from '../trackRegister';
import { pool } from '../database';
import { RpcContext } from '../rpcHandlerTypes';

export function trackingSubscribeHandler(ctx: RpcContext) {
  // TODO validate ctx.params
  const { token, deviceId, fromTime, maxCount, maxAge } = ctx.params;

  (async () => {
    const { user } = ctx.ctx.state || {};

    if (deviceId) {
      const [row] = await pool.query(
        SQL`SELECT userId FROM trackingDevice WHERE id = ${deviceId}`,
      );

      if (!row) {
        ctx.respondError(404, 'no such device');
        return;
      }

      if (!user || (!user.isAdmin && row.userId !== user.id)) {
        ctx.respondError(403, 'forbidden');
        return;
      }
    } else if (token) {
      const [row] = await pool.query(
        SQL`SELECT 1 FROM trackingAccessToken WHERE token = ${token}`,
      );

      if (!row) {
        ctx.ctx.throw(404, 'no such token');
      }
    }

    // TODO check if token exists

    let websockets = trackRegister.get(deviceId || token);

    if (!websockets) {
      websockets = new Set<ws>();
      trackRegister.set(deviceId || token, websockets);
    }

    websockets.add(ctx.ctx.websocket);

    let result;

    if (maxCount === 0 || maxAge === 0) {
      result = [];
    } else {
      const query = SQL`
        SELECT trackingPoint.id, lat, lon, message, trackingPoint.createdAt, altitude, speed, accuracy, hdop, bearing, battery, gsmSignal
        FROM trackingPoint`;

      query.append(
        deviceId
          ? SQL` WHERE deviceId = ${deviceId}`
          : SQL` JOIN trackingAccessToken
                    ON trackingPoint.deviceId = trackingAccessToken.deviceId
                    WHERE trackingAccessToken.token = ${token}`,
      );

      if (fromTime) {
        query.append(
          SQL` AND trackingPoint.createdAt >= ${new Date(fromTime)}`,
        );
      }

      if (maxAge) {
        query.append(
          SQL` AND TIMESTAMPDIFF(SECOND, trackingPoint.createdAt, now()) < ${Number(
            maxAge,
          )}`,
        );
      }

      if (token) {
        query.append(
          ` AND (timeFrom IS NULL OR trackingPoint.createdAt >= timeFrom)
            AND (timeTo IS NULL OR trackingPoint.createdAt < timeTo)`,
        );
      }

      query.append(' ORDER BY trackingPoint.id DESC');

      if (maxCount) {
        query.append(maxCount ? SQL` LIMIT ${Number(maxCount)}` : '');
      }

      result = await pool.query(query);

      result.reverse();
    }

    // TODO skip nulls

    ctx.respondResult(
      result.map((item: any) => ({
        id: item.id,
        ts: item.createdAt,
        lat: item.lat,
        lon: item.lon,
        message: ntu(item.message),
        altitude: ntu(item.altitude),
        speed: ntu(item.speed),
        accuracy: ntu(item.accuracy),
        hdop: ntu(item.hdop),
        bearing: ntu(item.bearing),
        battery: ntu(item.battery),
        gsmSignal: ntu(item.gsmSignal),
      })),
    );
  })().catch((err) => {
    ctx.respondError(500, err.message);
  });
}

function ntu<T>(x: T): T | undefined {
  return x === null ? undefined : x;
}
