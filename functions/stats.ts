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
 * Get difference in days between two Dates
 * @param d1 Date 1
 * @param d2 Date 2
 * @returns Number of days betwteen two dates
 */
function getDaysDifference(
  d1: Date,
  d2: Date,
): number {
  const timeDiff = Math.abs(d2.getTime() - d1.getTime());
  const oneDay: number = (24 * 60 * 60 * 1000) * 1;
  const diffDays = Math.ceil(timeDiff / oneDay);
  return diffDays;
}

/**
 * Check if two Dates are within a range of days
 * @param d1 Date 1
 * @param d2 Date 2
 * @param days Number of days to check for range
 * @returns Number of days betwteen two dates
 */
function getIsWithinDaysRange(
  d1: Date,
  d2: Date,
  days: number
): boolean {
  const diffDays = getDaysDifference(d1, d2);
  return diffDays <= days;
}

interface GameHighestNumberTagsPerNumberDaysData {
  tagCount: number;
  dayCount: number;
  startDate: Date | null;
  endDate: Date | null;
}
/**
 * Get game highest number of tags in specified number of days
 * @param tags Tags to get highest number of tags in days data
 * @param days Number of days
 * @returns Highest number of tags per number of days data
 */
function getGameHighestNumberTagsPerNumberDaysData(
  tags: Tag[],
  days: number = 1
): GameHighestNumberTagsPerNumberDaysData {
  let tagsPerNumberDaysHighest: number = 1;
  let previousTagDate: Date | null = null;
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let tagDatesInRange: Tag[] = [];
  let tagIsInRange: boolean = false;
  let tagsPerNumberDaysData: GameHighestNumberTagsPerNumberDaysData = {
    tagCount: tagsPerNumberDaysHighest,
    dayCount: days,
    startDate: null,
    endDate: null
  }
  const oneDay: number = (24 * 60 * 60 * 1000) * 1;
  const daysBack: number[] = [...Array(days).keys()];
  const sortedTags = [...tags].reverse();
  for (const tag of sortedTags) {
    const tagDate: Date = getTagDate(tag.mysteryTime);
    if (previousTagDate != null) {
      if (tagDatesInRange.length === 0) {
        // Initialize the array with the first date
        tagDatesInRange = [previousTagDate];
      }
      // Clone the array so it can be modified while iterating
      let tagDatesInRangeNew = Object.assign([], tagDatesInRange);
      for (const dayBack of daysBack) {
        // Calculate the date for the number of days back in time
        const daysBackTime: number = oneDay * dayBack;
        const tagDateMinusDayBack: Date = new Date();
        tagDateMinusDayBack.setTime(tagDate.getTime() - daysBackTime);
        for (const tid of tagDatesInRange) {
          // Check if the current tagDate is within acceptable range of days
          if (getIsWithinDaysRange(tid, tagDateMinusDayBack, days)) {
            tagDatesInRangeNew.push(tagDate);
            tagIsInRange = true;
            // Quit checking if it is in acceptable range of days
            break;
          } else {
            // Remove the old index that is no longer in the sliding range window
            const indexNotInRangeDate = tagDatesInRangeNew.indexOf(tid);
            tagDatesInRangeNew.splice(indexNotInRangeDate, 1);
            tagIsInRange = false;
          }
        }
        if (tagIsInRange) {
          // Quit checking if it is already confirmed to be in range
          break;
        }
      }
      // Update the main array with the new one
      tagDatesInRange = tagDatesInRangeNew;
      if (tagDatesInRange.length >= tagsPerNumberDaysHighest) {
        // Set stats to be reported if the previous tag number record was beat
        tagsPerNumberDaysHighest = tagDatesInRange.length;
        startDate = tagDatesInRange[0];
        endDate = tagDatesInRange[tagDatesInRange.length - 1];
      }
    }
    previousTagDate = tagDate;
  }
  tagsPerNumberDaysData = {
    tagCount: tagsPerNumberDaysHighest,
    dayCount: days,
    startDate: startDate,
    endDate: endDate
  }
  return tagsPerNumberDaysData;
}

interface PlayerHighestNumberTagsPerDayData {
  playerName: string,
  tagCount: number | null,
  tagDate: Date | null
}

/**
 * Get player's highest number of tags in one day data
 * @param player Player to get highest number of tags in one day data
 * @returns Highest number of tags per day data
 */
function getPlayerHighestNumberTagsPerDayData(
  player: Player
): PlayerHighestNumberTagsPerDayData {
  let tagsPerDayData: PlayerHighestNumberTagsPerDayData = {
    playerName: player.name,
    tagCount: null,
    tagDate: null
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
      tagsPerDayData.tagCount = tagsPerDayHighest;
      tagsPerDayData.tagDate = tagDate;
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
): PlayerHighestNumberTagsPerDayData[] {
  let tagsPerDayHighest: number = 0;
  let tagsPerDayData: PlayerHighestNumberTagsPerDayData[] = [];
  let highestTagsPerDayData: PlayerHighestNumberTagsPerDayData[] = [];
  for (const player of players) {
    if (player.name === '') {
      console.log('Player has no name, and probably no real data. Ignoring player: ', player)
      continue;
    }
    const tagsPerDayRecord: PlayerHighestNumberTagsPerDayData = getPlayerHighestNumberTagsPerDayData(player);
    tagsPerDayData.push(tagsPerDayRecord);
    if (tagsPerDayRecord.tagCount != null && tagsPerDayRecord.tagCount > tagsPerDayHighest) {
      tagsPerDayHighest = tagsPerDayRecord.tagCount;
    }
  }
  for (const tpdr of tagsPerDayData) {
    if (tpdr.tagCount != null && tpdr.tagCount >= tagsPerDayHighest) {
      highestTagsPerDayData.push(tpdr);
    }
  }
  return highestTagsPerDayData;
}

/**
 * Get the unique tag dates
 * @param tags Tags to get unique tag dates
 * @returns Array of unique tag dates
 */
function getUniqueTagDates(
  tags: Tag[]
): Date[] {
  let uniqueTagDates: Date[] = [];
  for (const tag of tags) {
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
 * Get the longest daily tag streak data
 * @param tags Tags to get longest streak of days with a tag data
 * @returns StreakData
 */
function getTagLongestDailyStreakData(
  tags: Tag[]
): StreakData {
  let tagDates: Date[] = getUniqueTagDates(tags);
  tagDates.sort((a, b) => a.getTime() - b.getTime());
  let streakDaysCount: number = 1;
  let streakDaysCountLongest: number = 1;
  let streakStartDate: Date | null = null;
  let streakLongestStartDate: Date | null = null;
  let streakEndDate: Date | null = null;
  let previousDate: Date | null = null;
  const oneDay: number = (24 * 60 * 60 * 1000) * 1;
  for (const td of tagDates) {
    if (previousDate != null) {
      // Determine if an actual (more than 1 day) streak started: Calculate the current tag 
      // mysteryTime minus one day, check if same date as previous array tag mysteryTime
      const tagDateMinusOneDay: Date = new Date();
      tagDateMinusOneDay.setTime(td.getTime() - oneDay);
      if (getIsSameDay(tagDateMinusOneDay, previousDate)) {
        streakDaysCount++;
        if (streakDaysCount === 2) {
          // Current streak start
          streakStartDate = previousDate;
        }
        if (streakDaysCount >= streakDaysCountLongest) {
          // Current longest streak start
          streakLongestStartDate = streakStartDate;
          streakDaysCountLongest = streakDaysCount;
          // Current longest streak end
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
    longestStreakStartDate: streakDaysCountLongest > 1 ? streakLongestStartDate : null,
    longestStreakEndDate: streakDaysCountLongest > 1 ? streakEndDate : null,
  }
  return streakData;
}

interface PlayerStreakData {
  playerName: string;
  longestStreakData: StreakData;
}

/**
 * Get the players data with the longest daily tag streak
 * @param players The array of players
 * @returns Array of players data with longest streak of days tagged
 */
function getPlayersWithLongestDailyTagStreakData(
  players: Player[]
): PlayerStreakData[] {
  let longestStreakDays: number = 0;
  let playerRecord: PlayerStreakData;
  let playersData: PlayerStreakData[] = [];
  for (const player of players) {
    if (player.name === '') {
      console.log('Player has no name, and probably no real data. Ignoring player: ', player)
      continue;
    }
    const playerLongestStreakData: StreakData = getTagLongestDailyStreakData(player.tags)
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

interface StatsReportData {
  playersWithMostTagsInOneDay: PlayerHighestNumberTagsPerDayData[],
  playersWithLongestTagStreakDaysData: PlayerStreakData[],
  gameTotalNumberOfPlayers: number,
  gameTotalNumberOfTags: number,
  gameHighestNumberTagsPerOneDayData: GameHighestNumberTagsPerNumberDaysData,
  gameHighestNumberTagsPerSevenDaysData: GameHighestNumberTagsPerNumberDaysData,
  gameLongestDailyTagStreakData: StreakData,
  gameLongestTimeBetweenTags: number
}

interface StatsResponse {
  data?: StatsReportData;
  success: boolean;
  error?: string;
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

  // Player(s) with most tags in one day
  const playersWithMostTagsInOneDayData: PlayerHighestNumberTagsPerDayData[] = getPlayersWithHighestNumberTagsPerDayData(playersResponse.data)

  // Player(s) with longest streak of daily tags
  const playersWithLongestTagStreakDaysData: PlayerStreakData[] = getPlayersWithLongestDailyTagStreakData(playersResponse.data)

  // Game total number of players
  const totalNumberOfPlayers: number = playersResponse.data.length;

  // Get Tags data
  const tagsResponse = await biketag.getTags(biketagPayload as getTagsPayload, {
    source: 'imgur',
  })

  // Game total number of tags
  const totalNumberOfTags: number = tagsResponse.data.length;

  // Game most tags in one day
  const gameHighestNumberTagsPerOneDayData: GameHighestNumberTagsPerNumberDaysData = getGameHighestNumberTagsPerNumberDaysData(tagsResponse.data);

  // Game most tags in one week
  const days = 7;
  const gameHighestNumberTagsPerSevenDaysData: GameHighestNumberTagsPerNumberDaysData = getGameHighestNumberTagsPerNumberDaysData(tagsResponse.data, days);

  // Game longest streak of daily tags
  const gameLongestDailyTagStreakData: StreakData = getTagLongestDailyStreakData(tagsResponse.data)

  // Longest time between tags
  const longestTimeBetweenTags: number = getLongestTimeBetweenTags(tagsResponse.data);

  let statusCode: number = 400;
  if (playersResponse.status === 200 && tagsResponse.status === 200) {
    statusCode = 200;
  }
  const success = playersResponse.success && tagsResponse.success;
  const data: StatsReportData = {
    playersWithMostTagsInOneDay: playersWithMostTagsInOneDayData,
    playersWithLongestTagStreakDaysData: playersWithLongestTagStreakDaysData,
    gameTotalNumberOfPlayers: totalNumberOfPlayers,
    gameTotalNumberOfTags: totalNumberOfTags,
    gameHighestNumberTagsPerOneDayData: gameHighestNumberTagsPerOneDayData,
    gameHighestNumberTagsPerSevenDaysData: gameHighestNumberTagsPerSevenDaysData,
    gameLongestDailyTagStreakData: gameLongestDailyTagStreakData,
    gameLongestTimeBetweenTags: longestTimeBetweenTags
  }
  const statsResponse: {} = {
    data: success ? data : undefined,
    success: success,
    error: !success ? 'Failed to retrieve stats' : undefined,
  }
  return {
    statusCode: statusCode,
    body: JSON.stringify(statsResponse),
  }
}

const handler = builder(statsHandler)

export { handler }
