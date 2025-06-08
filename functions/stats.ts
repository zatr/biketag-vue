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
  let tagsPerDayData: {} = {
    'tagCount': 0,
    'tagDate': new Date()
  };
  let tagsPerDay: number = 1;
  let tagsPerDayHighest: number = 1;
  let previousTagDate: Date | null = null;
  for (const tag of player.tags) {
    const tagDate: Date = getTagDate(tag.mysteryTime);
    if (previousTagDate != null && getIsSameDay(tagDate, previousTagDate)) {
      tagsPerDay++;
    } else {
      tagsPerDay = 1;
    }
    if (tagsPerDay > tagsPerDayHighest) {
      tagsPerDayHighest = tagsPerDay;
      tagsPerDayData = {
        'playerName': player.name,
        'tagCount': tagsPerDayHighest,
        'tagDate': tagDate,
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
  let tagsPerDayHighest: number = 0;
  let tagsPerDayData: Array<{}> = [];
  for (const player of players) {
    const tagsPerDayRecord: {} = getPlayerHighestNumberTagsPerDayData(player);
    tagsPerDayData.push(tagsPerDayRecord);
    if (tagsPerDayRecord['tagCount'] > tagsPerDayHighest) {
      tagsPerDayHighest = tagsPerDayRecord['tagCount'];
    }
  }
  let highestTagsPerDayData: Array<{}> = [];
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
  let uniqueTagDates: Date[] = [];
  for (const tag of player.tags) {
    if (tag.mysteryTime === 0) {
      // There are some mysteryTime entries with 0 value. Ignore them.
      continue;
    }
    const tagDate: Date = getTagDate(tag.mysteryTime);
    if (uniqueTagDates.length === 0) {
      uniqueTagDates.push(tagDate);
    } else {
      const isAlreadyPresent = uniqueTagDates.some(date => getIsSameDay(date, tagDate));
      if (!isAlreadyPresent) {
        uniqueTagDates.push(tagDate);
      }
    }
  }
  return uniqueTagDates;
}

interface StreakData {
  longestStreakDaysCount: number;
  longestStreakStartDate: Date | null;
  longestStreakEndDate: Date | null;
}

/**
 * Get the player's longest streak of days with a tag data
 * @param player Player to get longest streak of days with a tag data
 * @returns Object containing longest streak days count, streak start date, streak end date
 */
function getPlayerTagLongestStreakData(
  player: Player
): StreakData {
  let tagDates: Date[] = getPlayerUniqueTagDates(player);
  tagDates.sort((a, b) => a.getTime() - b.getTime());
  let streakDaysCount: number = 1;
  let streakDaysCountLongest: number = 1;
  let streakStartDate: Date | null = null;
  let streakEndDate: Date | null = null;
  let previousDate: Date | null = null;
  const oneDay: number = (24 * 60 * 60 * 1000) * 1;
  for (const td of tagDates) {
    const index: number = tagDates.indexOf(td);
    if (previousDate != null) {
      // Determine if an actual (more than 1 day) streak started: Calculate the current tag 
      // mysteryTime minus one day, check if same date as previous array tag mysteryTime
      const tagDateMinusOneDay: Date = new Date();
      tagDateMinusOneDay.setTime(td.getTime() - oneDay);
      if (getIsSameDay(tagDateMinusOneDay, previousDate)) {
        streakDaysCount++;
        if (streakDaysCount >= streakDaysCountLongest) {
          if (streakDaysCount === 2) {
            // Current streak start
            streakStartDate = previousDate;
          }
          // Current streak end
          streakDaysCountLongest = streakDaysCount;
          streakEndDate = td;
        }
      } else {
        // The streak is over
        streakDaysCount = 1;
      }
    } else {
      // Set streak start/end dates for players without an actual streak (>1 day)
      streakStartDate = td;
      streakEndDate = td;
    }
    previousDate = td;
  }
  const streakData: StreakData = {
    longestStreakDaysCount: streakDaysCountLongest,
    longestStreakStartDate: streakStartDate,
    longestStreakEndDate: streakEndDate,
  }
  return streakData;
}

interface PlayerStreakData {
  playerName: string;
  longestStreakData: StreakData;
}

/**
 * Get the players data with the longest streak of days tagged
 * @param players The array of players
 * @returns Array of players data with longest streak of days tagged
 */
function getPlayersDataWithLongestStreakDaysTagged(
  players: Player[]
): PlayerStreakData[] {
  let longestStreakDays: number = 0;
  let playerRecord: PlayerStreakData;
  let playersData: PlayerStreakData[] = [];
  for (const player of players) {
    const playerLongestStreakData = getPlayerTagLongestStreakData(player)
    if (playerLongestStreakData.longestStreakDaysCount > longestStreakDays) {
      longestStreakDays = playerLongestStreakData.longestStreakDaysCount;
    }
    playerRecord = {
      playerName: player.name,
      longestStreakData: playerLongestStreakData
    }
    playersData.push(playerRecord);
  }
  let longestStreakPlayersData: PlayerStreakData[] = [];
  for (const pd of playersData) {
    if (pd.longestStreakData.longestStreakDaysCount >= longestStreakDays) {
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
  let longestTimeBetweenTags: number = 0;
  let previousTag: Tag | null = null;
  const sortedTags = [...tags].reverse();
  for (const tag of sortedTags) {
    if (previousTag != null) {
      const timeBetweenTags: number = tag.mysteryTime - previousTag.mysteryTime
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
  if (!biketagOpts.game) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Game parameter is required' }),
    }
  }
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

  // Player(s) with most tags in one day (total, time)
  const playersWithMostTagsInOneDayData: {} = getPlayersWithHighestNumberTagsPerDayData(playersResponse.data)

  // Players with longest streak of days with a tag (total days, start time, end time)
  const playersWithLongestTagStreakDaysData: {} = getPlayersDataWithLongestStreakDaysTagged(playersResponse.data)

  // Total number of players
  const totalNumberOfPlayers: number = playersResponse.data.length;

  // Get Tags data
  const tagsResponse = await biketag.getTags(biketagPayload as getTagsPayload, {
    source: 'imgur',
  })

  // Total number of tags
  const totalNumberOfTags: number = tagsResponse.data.length;

  // Longest time between tags
  const longestTimeBetweenTags: number = getLongestTimeBetweenTags(tagsResponse.data);

  let statusCode: number = 400;
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
  const statsResponse: {} = {
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
