<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="container">
    <div class="search-bar">
      <b-form-input type="search" v-model="searchBoxInput" @keyup.enter="performSearch"
      />
      <bike-tag-button @click="performSearch">
        {{ t('pages.players.search') }}
      </bike-tag-button>
    </div>
    <div class="player-list">
      <div v-for="player in displayedPlayers" :key="player.name" class="p-lg-3 p-md-2 mb-2">
        <player-bicon size="md" :player="player" />
      </div>
    </div>
    <p v-if="!searchResults.length">
      {{ t('pages.players.not_found') }}
    </p>
    <bike-tag-button v-if="route.name === 'Player Search'" @click="clearSearch">
      {{ t('pages.players.exit_search') }}
    </bike-tag-button>
    <b-form-group>
      <select v-model="perPage" class="form-select mb-2 m-auto" @change="handlePerPageSelect">
        <option v-for="opt in perPageOptions" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>
    </b-form-group>
    <b-pagination
      v-model="currentPage"
      :total-rows="searchResults.length"
      :per-page="perPage"
      aria-controls="itemList"
      align="center"
      @page-click="changePage"
    ></b-pagination>
  </div>
</template>

<script setup name="PlayersView">
import { useBikeTagStore } from '@/store/index';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// components
import BikeTagButton from '@/components/BikeTagButton.vue';
import PlayerBicon from '@/components/BikeTagPlayer.vue';
import { useI18n } from 'vue-i18n';

// data
const perPageOptions = ["10","100","1000"]
const defaultQuery = {perPage: perPageOptions[0]}
const router = useRouter()
const route = useRoute()
const currentPage = ref(route.query?.currentPage ? parseInt(route.query?.currentPage) : 1)
const perPage = ref(route.query?.perPage ? parseInt(route.query?.perPage) : defaultQuery.perPage)
const searchString = ref(route.query?.searchString || "")
const searchBoxInput = ref(searchString.value)
const store = useBikeTagStore()
const { t } = useI18n()

onMounted(() => validateQuery())

// computed
const getPlayers = computed(() => store.getPlayers)
const searchResults = computed(() => {
  if (!searchString.value) {
    return getPlayers.value
  } else {
    const lowerQuery = searchString.value.toLowerCase()
    const startingWithSearchString = []
    const containingSearchString = []
    for (let player of getPlayers.value) {
      const lowerName = player.name.toLowerCase()
      if (lowerName.startsWith(lowerQuery)) {
        startingWithSearchString.push(player)
      } else if (lowerName.includes(lowerQuery)) {
        containingSearchString.push(player)
      }
    }
    return sortedByName(startingWithSearchString).concat(sortedByName(containingSearchString))
  }
})
const displayedPlayers = computed(() =>
  searchResults.value.slice(
    (currentPage.value - 1) * perPage.value,
    currentPage.value * perPage.value,
  ),
)

// methods
const changePage = (_event, pageNumber) => {
  searchBoxInput.value = searchString.value
  currentPage.value = pageNumber
  router.push({query: {
    ...defaultQuery,
    ...route.query,
    currentPage: pageNumber
  }})
}
const resetPageNumber = () => {
  searchBoxInput.value = searchString.value
  currentPage.value = 1
  router.replace({query: {
    ...defaultQuery,
    ...route.query,
    currentPage: currentPage.value
  }})
}
const handlePerPageSelect = () => {
  searchBoxInput.value = searchString.value
  currentPage.value = 1
  router.push({query: {
    ...defaultQuery,
    ...route.query,
    perPage: perPage.value,
    currentPage: currentPage.value
  }})
}
const sortedByName = (list) => {
  return list.toSorted((a,b) => a.name.localeCompare(b.name))
} 
const clearSearch = () => {
  searchBoxInput.value = ''
  searchString.value = ''
  router.push({name: 'Players', query: {perPage: perPage.value}})
}
const performSearch = () => {
  searchString.value = searchBoxInput.value
  if (!searchString.value) {
    router.push({name: 'Players', query: {perPage: perPage.value}})
  } else {
    router.push({name: 'Player Search', query: {
      ...defaultQuery,
      ...route.query,
      searchString: searchString.value
    }}).then(resetPageNumber)
  }
}
const validateQuery = () => {
  if (!perPageOptions.includes(String(perPage.value))) {
    perPage.value = defaultQuery.perPage
    router.replace({query: {...route.query, perPage: perPage.value}})
    .then(resetPageNumber)
  }
  else if (isNaN(currentPage.value) ||
      currentPage.value !== 1 && displayedPlayers.value.length === 0) {
    resetPageNumber()
  }
}

//watch
watch(
  () => route,
  () => {
    // reset all data that comes from the URL
    currentPage.value = route.query?.currentPage ? parseInt(route.query?.currentPage) : 1
    perPage.value = route.query?.perPage ? parseInt(route.query?.perPage) : defaultQuery.perPage
    searchString.value = route.query?.searchString || ""
    searchBoxInput.value = searchString.value
    validateQuery()
  },
  { deep: true }
);
</script>
