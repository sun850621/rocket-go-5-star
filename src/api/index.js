/**
 * 在 Elasticsearch 中查詢地點翻譯 (index_poi_location_translation)。
 *
 * 用戶輸入的關鍵字會以 multi_match 搜尋 `translated_area0` 欄位，
 * 並限制語言為 `zh-tw`，返回前 10 筆最相關的結果。
 *
 * @async
 * @function querySearch
 * @param {string} queryString - 使用者輸入的搜尋關鍵字。
 * @returns {Promise<Array<{
 *   value: string,     // 用於 autocomplete 顯示的文字（多個 area 合併）
 *   score: number,     // Elasticsearch 的相關性分數
 *   raw: Object        // 原始的 Elasticsearch _source 資料
 * }>>} - 整理過的搜尋結果陣列。
 *
 */
export const querySearch = async (queryString) => {
    if (!queryString) return []

    try {
        const body = {
            query: {
                bool: {
                    must: {
                        multi_match: {
                            query: queryString,
                            fields: ['translated_area0^1'],
                            type: 'most_fields',
                            operator: 'AND',
                            analyzer: 'index_analyzer',
                        },
                    },
                    filter: [{ term: { language: 'zh-tw' } }],
                },
            },
            from: 0,
            size: 10,
            sort: [{ _score: 'desc' }],
            min_score: 0,
        }

        const res = await fetch(
            'https://b19872a843024119967e84f465a4a5c7.asia-east1.gcp.elastic-cloud.com:443/index_poi_location_translation/_search',
            {
                method: 'POST',
                headers: {
                    Authorization:
                        'ApiKey OXB5WXM0MEJhYXQ5aFVfWjdHYXc6bjZpTWlIU3lRZHlxbHh6TUNyM3ZyUQ==',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        )

        const json = await res.json()
        const hits = json.hits?.hits ?? []

        return hits.map((h) => {
            const {
                translated_area1,
                translated_area2,
                translated_area3,
                translated_area4,
            } = h._source
            const parts = [
                translated_area1,
                translated_area2,
                translated_area3,
                translated_area4,
            ].filter((p) => p && p.trim())

            return {
                value: parts.join(', '),
                score: h._score,
                raw: h._source,
            }
        })
    } catch (err) {
        console.error('Fetch suggestions error:', err)
        return []
    }
}

/**
 * 在 Elasticsearch 中依主軸(custom_main_category)、細項(custom_sub_category)進行聚合統計。
 *
 * 用戶可傳入篩選條件（例如 area1_keyword、area4_keyword），會被轉換成 term filter，
 * 然後在 index_poi_raw2_global 上進行 composite aggregation，
 * 回傳每個 (mainCategory, subCategory) 的出現數量。
 *
 * @async
 * @function queryGroupBy
 * @param {Object} filters - 篩選條件，例如 { area1_keyword: 'KZ', area4_keyword: 'Taipei' }。
 *                           物件的 key 會轉成 term 查詢。
 * @returns {Promise<Array<{
 *   mainCategory: string,   // 主軸分類名稱 (custom_main_category)
 *   subCategory: string,    // 細項分類名稱 (custom_sub_category)
 *   count: number           // 該分類的數量
 * }>>} - 聚合後的分類統計結果陣列。
 */
export async function queryGroupBy(filters = {}) {
    try {
        // 把 filters 轉成 ES term 查詢 (排除空字串 / null / undefined)
        const filterTerms = Object.entries(filters)
            .filter(([_, value]) => value && String(value).trim() !== '')
            .map(([key, value]) => ({
                term: { [key]: value },
            }))

        const body = {
            size: 0,
            query: {
                bool: {
                    filter: filterTerms,
                },
            },
            aggs: {
                custom_category_aggs: {
                    composite: {
                        size: 1000,
                        sources: [
                            {
                                custom_main_category: {
                                    terms: { field: 'custom_main_category' },
                                },
                            },
                            {
                                custom_sub_category: {
                                    terms: { field: 'custom_sub_category' },
                                },
                            },
                        ],
                    },
                    aggs: {
                        ratings_max: {
                            max: {
                                field: 'user_ratings_total',
                                missing: 0,
                            },
                        },
                    },
                },
            },
        }

        const res = await fetch(
            'https://b19872a843024119967e84f465a4a5c7.asia-east1.gcp.elastic-cloud.com:443/index_poi_raw2_global/_search',
            {
                method: 'POST',
                headers: {
                    Authorization:
                        'ApiKey OXB5WXM0MEJhYXQ5aFVfWjdHYXc6bjZpTWlIU3lRZHlxbHh6TUNyM3ZyUQ==',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        )

        const json = await res.json()
        const buckets = json.aggregations?.custom_category_aggs?.buckets ?? []

        // 整理輸出格式
        return buckets
            .map((b) => ({
                mainCategory: b.key.custom_main_category,
                subCategory: b.key.custom_sub_category,
                count: b.doc_count,
                rating: b.ratings_max.value,
            }))
            .sort((a, b) => b.rating - a.rating)
    } catch (err) {
        console.error('queryGroupBy error:', err)
        return []
    }
}

/**
 * 查詢指定地點與分類下的 POI 清單
 *
 * 可篩選的條件包含：
 * - area1_keyword, area2_keyword, area3_keyword, area4_keyword
 * - custom_main_category, custom_sub_category
 * 可額外輸入 keyword 做全文搜尋
 *
 * @async
 * @function queryPoiList
 * @param {Object} filters - 篩選條件
 * @param {number} [from=0] - 起始 offset
 * @param {number} [size=20] - 回傳筆數
 * @param {string} [keyword] - 關鍵字
 * @returns {Promise<{ data: Array<Object>, totalCount: number }>}
 */
export async function queryPoiList(
    filters = {},
    from = 0,
    size = 20,
    keyword = ''
) {
    try {
        const filterTerms = Object.entries(filters)
            .filter(([_, value]) => value && String(value).trim() !== '')
            .map(([key, value]) => ({ term: { [key]: value } }))

        // 如果有 keyword 就放進 must
        const mustQuery = keyword
            ? {
                  multi_match: {
                      query: keyword,
                      fields: ['main_title^1', 'category^1'],
                      type: 'most_fields',
                      operator: 'AND',
                      analyzer: 'index_analyzer',
                  },
              }
            : undefined

        const body = {
            query: {
                bool: {
                    filter: filterTerms,
                    ...(mustQuery ? { must: mustQuery } : {}),
                },
            },
            from,
            size,
            sort: [{ user_ratings_total: 'desc' }],
            _source: [
                'place_id',
                'main_title',
                'user_ratings_total',
                'rating',
                'category',
                'custom_sub_category',
                'custom_main_category',
                'address',
                'location',
            ],
            track_scores: false,
        }

        const res = await fetch(
            'https://b19872a843024119967e84f465a4a5c7.asia-east1.gcp.elastic-cloud.com:443/index_poi_raw2_global/_search',
            {
                method: 'POST',
                headers: {
                    Authorization:
                        'ApiKey OXB5WXM0MEJhYXQ5aFVfWjdHYXc6bjZpTWlIU3lRZHlxbHh6TUNyM3ZyUQ==',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        )

        const json = await res.json()
        const hits = json.hits?.hits ?? []
        const totalCount = json.hits?.total?.value ?? 0

        return {
            data: hits.map((h) => h._source),
            totalCount,
        }
    } catch (err) {
        console.error('queryPoiList error:', err)
        return { data: [], totalCount: 0 }
    }
}
