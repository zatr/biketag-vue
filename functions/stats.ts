import { builder, Handler } from '@netlify/functions'
import { BikeTagClient } from 'biketag'
import { getStatsPayload } from 'biketag/dist/common/payloads'
import { Game } from 'biketag/dist/common/schema'
import request from 'request'
import { getBikeTagClientOpts, getPayloadOpts } from './common'


const statsHandler: Handler = async (event) => {
  const biketagOpts = getBikeTagClientOpts(
     {
       ...event,
       method: event.httpMethod,
     } as unknown as request.Request,
     true,
   )
   const biketag = new BikeTagClient(biketagOpts)
   const game = (await biketag.game(biketagOpts.game, {
     source: 'sanity',
     concise: true,
   })) as unknown as Game
   const biketagPayload = getPayloadOpts(event, {
     imgur: {
       hash: game.mainhash,
     },
     game: biketagOpts.game,
   })
   /// TODO: get stats from sanity source first, then fire off new call to gather stats from imgur and save them into sanity
   const statsResponse = await biketag.getStats(biketagPayload as getStatsPayload, {
     source: 'imgur',
   })
   const { success, data } = statsResponse
   return {
     statusCode: statsResponse.status,
     body: JSON.stringify(success ? data : statsResponse),
   }
}

const handler = builder(statsHandler)

export { handler }
