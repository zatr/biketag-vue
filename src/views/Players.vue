<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <Searchable
    item-type="players"
    :items="store.getPlayers"
    :search-algo="playerSearch"
    main-route="Players"
    search-route="Player Search"
  >
    <template #content="{ displayedItems }">
      <div class="player-list">
        <div v-for="player in displayedItems" :key="player.name" class="p-lg-3 p-md-2 mb-2">
          <player-bicon size="md" :player="player" />
        </div>
      </div>
    </template>
  </Searchable>
</template>

<script setup name="PlayersView">
import Searchable from '@/components/Searchable.vue'
import PlayerBicon from '@/components/BikeTagPlayer.vue'
import { useBikeTagStore } from '@/store/index'

const store = useBikeTagStore()

const playerSearch = (players, searchString) => {
  const query = searchString.toLowerCase().trim()
  const startingWithQuery = []
  const containingQuery = []
  for (const player of players) {
    const lowerName = player.name.toLowerCase()
    if (lowerName.startsWith(query)) {
      startingWithQuery.push(player)
    } else if (lowerName.includes(query)) {
      containingQuery.push(player)
    }
  }
  return sortedByName(startingWithQuery).concat(sortedByName(containingQuery))
}
const sortedByName = (list) => {
  return list.toSorted((a, b) => a.name.localeCompare(b.name))
}
</script>
