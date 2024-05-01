<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div v-if="items.length" class="container">
    <div class="search-bar">
      <b-form-input v-model="searchBoxInput" type="search" @keyup.enter="performSearch" />
      <bike-tag-button @click="performSearch">
        {{ t(`pages.${itemType}.search`) }}
      </bike-tag-button>
    </div>
    <slot name="content" :displayed-items="displayedItems"></slot>
    <p v-if="!searchResults.length && searchString">
      {{ t(`pages.${itemType}.not_found`) }}
    </p>
    <bike-tag-button
      v-if="route.name === searchRoute"
      class="clear-search-button"
      @click="clearSearch"
    >
      {{ t(`pages.${itemType}.exit_search`) }}
    </bike-tag-button>
    <b-form-group>
      <select v-model="perPage" class="form-select mb-2 m-auto" @change="handlePerPageSelect">
        <option v-for="opt in perPageOptions" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>
    </b-form-group>
    <b-pagination
      :model-value="currentPage"
      :total-rows="searchResults.length"
      :per-page="perPage"
      align="center"
      @page-click="changePage"
    ></b-pagination>
  </div>
  <div v-else class="container mt-4 mb-5">
    <span class="body-text">
      {{ t(`pages.${itemType}.empty`) }}
    </span>
  </div>
  <loading
    v-if="loadingActive"
    v-model:active="loadingActive"
    :is-full-page="true"
    @click="console.log(loadingActive)"
  >
    <img class="spinner" src="@/assets/images/SpinningBikeV1.svg" alt="Loading..." />
  </loading>
</template>

<script setup name="Searchable">
import { useBikeTagStore } from '@/store/index'
import { computed, onMounted, ref, watch } from 'vue'
import 'vue-loading-overlay/dist/css/index.css'
import { useRoute, useRouter } from 'vue-router'

// components
import BikeTagButton from '@/components/BikeTagButton.vue'
import { useI18n } from 'vue-i18n'
import Loading from 'vue-loading-overlay'

// props
const props = defineProps({
  itemType: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  searchAlgo: {
    // function that takes a list of items and a search string
    // and returns a filtered, sorted list
    type: Function,
    required: true,
  },
  mainRoute: {
    type: String,
    required: true,
  },
  searchRoute: {
    type: String,
    required: true,
  },
})

// data
const perPageOptions = ['10', '100', '1000']
const defaultQuery = { perPage: perPageOptions[0] }
const router = useRouter()
const route = useRoute()
const currentPage = ref(route.query?.currentPage ? parseInt(route.query?.currentPage) : 1)
const perPage = ref(route.query?.perPage ? parseInt(route.query?.perPage) : defaultQuery.perPage)
const searchString = ref(route.query?.searchString || '')
const searchBoxInput = ref(searchString.value)
const reachedLoadingTimeout = ref(false)
const { t } = useI18n()
const store = useBikeTagStore()

onMounted(() => {
  validateQuery()
  setTimeout(() => {
    console.log('not loading no more')
    reachedLoadingTimeout.value = true
  }, 1000)
})

// computed
const searchResults = computed(() => {
  if (!searchString.value) {
    return props.items
  } else {
    return props.searchAlgo(props.items, searchString.value)
  }
})
const displayedItems = computed(() =>
  searchResults.value.slice(
    (currentPage.value - 1) * perPage.value,
    currentPage.value * perPage.value,
  ),
)
const loadingActive = computed(() => store.fetchingData && !reachedLoadingTimeout.value)

// methods
const changePage = (_event, pageNumber) => {
  searchBoxInput.value = searchString.value
  currentPage.value = pageNumber
  router.push({
    query: {
      ...defaultQuery,
      ...route.query,
      currentPage: pageNumber,
    },
  })
}
const resetPageNumber = () => {
  searchBoxInput.value = searchString.value
  currentPage.value = 1
  router.replace({
    query: {
      ...defaultQuery,
      ...route.query,
      currentPage: currentPage.value,
    },
  })
}
const handlePerPageSelect = () => {
  searchBoxInput.value = searchString.value
  currentPage.value = 1
  router.push({
    query: {
      ...defaultQuery,
      ...route.query,
      perPage: perPage.value,
      currentPage: currentPage.value,
    },
  })
}
const clearSearch = () => {
  searchBoxInput.value = ''
  searchString.value = ''
  router.push({ name: props.mainRoute, query: { perPage: perPage.value } })
}
const performSearch = () => {
  searchString.value = searchBoxInput.value
  if (!searchString.value) {
    router.push({ name: props.mainRoute, query: { perPage: perPage.value } })
  } else {
    router
      .push({
        name: props.searchRoute,
        query: {
          ...defaultQuery,
          ...route.query,
          searchString: searchString.value,
        },
      })
      .then(resetPageNumber)
  }
}
const validateQuery = () => {
  if (!perPageOptions.includes(String(perPage.value))) {
    perPage.value = defaultQuery.perPage
    router.replace({ query: { ...route.query, perPage: perPage.value } }).then(resetPageNumber)
  } else if (
    isNaN(currentPage.value) ||
    (currentPage.value !== 1 && displayedItems.value.length === 0)
  ) {
    resetPageNumber()
  }
}

// watch
watch(
  () => route,
  () => {
    // reset all data that comes from the URL
    currentPage.value = route.query?.currentPage ? parseInt(route.query?.currentPage) : 1
    perPage.value = route.query?.perPage ? parseInt(route.query?.perPage) : defaultQuery.perPage
    searchString.value = route.query?.searchString || ''
    searchBoxInput.value = searchString.value
    validateQuery()
  },
  { deep: true },
)
</script>
