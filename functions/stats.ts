import { builder, Handler } from '@netlify/functions'
import { BikeTagClient } from 'biketag'
import { getPlayersPayload, getTagsPayload } from 'biketag/dist/common/payloads'
import { Game, Player, Tag } from 'biketag/dist/common/schema'
import request from 'request'
import { getBikeTagClientOpts, getPayloadOpts } from './common'
import { getTagDate } from '../src/common'

/**
 * Check if two date objects are on the same date
 * @param d1 Date 1
 * @param d2 Date 2
 * @returns True if dates are the same
 */
function getIsSameDay(
  d1: Date,
  d2: Date
): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

/**
 * Get player's highest number of tags in one day data
 * @param player Player to get highest number of tags in one day data
 * @returns Highest number of tags per day data
 */
function getPlayerHighestNumberTagsPerDayData(
  player: Player
): {} {
  let tagsPerDayData : {} = {
    'tagCount': 0,
    'tagDate': new Date()
  };
  let tagsPerDay : number = 1;
  let tagsPerDayHighest : number = 1;
  let previousTagDate : Date | null = null;
  for (const tag of player.tags) {
    const tagDate : Date = getTagDate(tag.mysteryTime);
    if (previousTagDate != null && getIsSameDay(tagDate, previousTagDate)) {
      tagsPerDay++;
    } else {
      tagsPerDay = 1;
    }
    if (tagsPerDay > tagsPerDayHighest) {
      tagsPerDayData = {
        'tagCount': tagsPerDay,
        'tagDate': tagDate
      }
    }
    previousTagDate = tagDate;
  }
  return tagsPerDayData;
}

/**
 * Get the players with the highest number of tags in one day data
 * @param players Players to get highest number of tags in one day data
 * @returns Count for highest number of tags in one day
 */
function getPlayersWithHighestNumberTagsPerDayData(
  players: Player[]
): Array<{}> {
  let tagsPerDayHighest : number = 0;
  let tagsPerDayData : Array<{}> = [];
  for (const player of players) {
    const tagsPerDayRecord : {} = getPlayerHighestNumberTagsPerDayData(player);
    tagsPerDayData.push(tagsPerDayRecord);
    if (tagsPerDayRecord['tagCount'] > tagsPerDayHighest) {
      tagsPerDayHighest = tagsPerDayRecord['tagCount'];
    }
  }
  let highestTagsPerDayData : Array<{}> = [];
  for (const tpdr of tagsPerDayData) {
    if (tpdr['tagCount'] >= tagsPerDayHighest) {
      highestTagsPerDayData.push(tpdr);
    }
  }
  return highestTagsPerDayData;
}

/**
 * Get the player's unique tag dates
 * @param player Player to get unique tag dates
 * @returns Array of unique tag dates
 */
function getPlayerUniqueTagDates(
  player: Player
): Date[] {
  let uniqueTagDates : Date[] = [];
  for (const tag of player.tags) {
      const tagDate : Date = getTagDate(tag.mysteryTime);
      if (uniqueTagDates.length === 0) {
        uniqueTagDates.push(tagDate);
      } else {
        for (const utd of uniqueTagDates) {
          if (!getIsSameDay(utd, tagDate)) {
            uniqueTagDates.push(tagDate);
          }
        }
      }
    }
  return uniqueTagDates;
}

/**
 * Get the player's longest streak of days with a tag data
 * @param player Player to get longest streak of days with a tag data
 * @returns Object containing longest streak days count, streak start date, streak end date
 */
function getPlayerTagLongestStreakData(
  player: Player
): {} {
  let tagDates : Date[] = getPlayerUniqueTagDates(player);
  tagDates.sort((a, b) => a.getTime() - b.getTime());
  let streakDaysCount : number | null = null;
  let streakStartDate : Date | null = null;
  let streakEndDate : Date | null = null;
  let onStreak : boolean = false;
  for (const td of tagDates) {
    const tagDateMinusOneDay : Date = new Date(td.getDate() - 1);
    const index : number = tagDates.indexOf(td);
    if (index === 0) {
      continue;
    } else {
      const indexMinusOneDate = tagDates[index-1]
      if (getIsSameDay(tagDateMinusOneDay, indexMinusOneDate)) {
        if (!onStreak) {
          streakStartDate = indexMinusOneDate;
        }
        streakEndDate = td;
        onStreak = true;
      } else {
        onStreak = false;
      }
    }
  }
  if (streakStartDate != null && streakEndDate != null) {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffTime = streakEndDate.getTime() - streakStartDate.getTime();
    streakDaysCount = Math.round(diffTime / oneDay) + 1;
  }

  const streakData : {} = {
    'longestStreakDaysCount': streakDaysCount,
    'longestStreakStartDate': streakStartDate,
    'longestStreakEndDate': streakEndDate,
  }
  return streakData;
}


/**
 * Get the players data with the longest streak of days tagged
 * @param players The array of players
 * @returns Array of players data with longest streak of days tagged
 */
function getPlayersDataWithLongestStreakDaysTagged(
  players: Player[]
): Array<{}> {
  let longestStreakDays : number = 0;
  let playerRecord : {};
  let playersData : Array<{}> = [];
  for (const player of players) {
    const playerLongestStreakData = getPlayerTagLongestStreakData(player)
    if (playerLongestStreakData['streakDaysCount'] > longestStreakDays) {
      longestStreakDays = playerLongestStreakData['longestStreakDaysCount'];
    }
    playerRecord = {
      'player': player,
      'longestStreakData': playerLongestStreakData
    }
    playersData.push(playerRecord);
  }
  let longestStreakPlayersData : Array<{}> = [];
  for (const pd of playersData) {
    if (pd['longestStreakDays'] >= longestStreakDays) {
      longestStreakPlayersData.push(pd);
    }
  }
  return longestStreakPlayersData;
}

/**
 * Get the longest time between tags
 * @param tags The array of tags
 * @returns Time between tags
 */
function getLongestTimeBetweenTags(
  tags: Tag[]
): number {
  let longestTimeBetweenTags : number = 0;
  let previousTag : Tag | null = null;
  for (const tag of tags) {
    if (longestTimeBetweenTags === 0) {
      continue;
    } else {
      const timeBetweenTags : number = tag.mysteryTime - previousTag.mysteryTime
      if (timeBetweenTags > longestTimeBetweenTags) {
        longestTimeBetweenTags = timeBetweenTags;
      }
    }
    previousTag = tag;
  }
  return longestTimeBetweenTags;
}

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

  // Get Players data
  const playersResponse = await biketag.getPlayers(biketagPayload as getPlayersPayload, {
    source: 'imgur',
  })
  console.log(`getPlayers response: ${playersResponse}`);

  // Player(s) with most tags in one day (total, time)
  const playersWithMostTagsInOneDayData : {} = getPlayersWithHighestNumberTagsPerDayData(playersResponse.data)

  // Players with longest streak of days with a tag (total days, start time, end time)
  const playersWithLongestTagStreakDaysData : {} = getPlayersDataWithLongestStreakDaysTagged(playersResponse.data)

  // Total number of players
  const totalNumberOfPlayers : number = playersResponse.data.length;

  // Get Tags data
  const tagsResponse = await biketag.getTags(biketagPayload as getTagsPayload, {
    source: 'imgur',
  })
  console.log(`getTags response: ${tagsResponse}`);

  // Total number of tags
  const totalNumberOfTags : number = tagsResponse.data.length;

  // Longest time between tags
  const longestTimeBetweenTags : number = getLongestTimeBetweenTags(tagsResponse.data);

  let statusCode : number = 400;
  if (playersResponse.status === 200 && tagsResponse.status === 200) {
    statusCode = 200;
  }
  const success = playersResponse.success && tagsResponse.success;
  const data = {
    'playersWithMostTagsInOneDay': playersWithMostTagsInOneDayData,
    'playersWithLongestTagStreakDaysData': playersWithLongestTagStreakDaysData,
    'totalNumberOfPlayers': totalNumberOfPlayers,
    'totalNumberOfTags': totalNumberOfTags,
    'longestTimeBetweenTags': longestTimeBetweenTags
  }
  const statsResponse : {} = {
    'data': data,
    'success': success,
    'error': !success ? 'Something went wrong' : undefined,
  }
  return {
    statusCode: statusCode,
    body: JSON.stringify(success ? data : statsResponse),
  }
}

const handler = builder(statsHandler)

export { handler }
