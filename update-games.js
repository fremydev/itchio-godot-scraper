const cheerio = require('cheerio')
const flattenDeep = require('./utils/flattenDeep')
const fs = require('fs')
const mkdir = require('./utils/mkdir')
const path = require('path')
const readJSON = require('./utils/readJSON')
const readline = require('readline')
const request = require('request')
const sortByKey = require('./utils/sortByKey')
const writeJSON = require('./utils/writeJSON')

const http = require('http')
const https = require('https')
http.globalAgent.maxSockets = 1
https.globalAgent.maxSockets = 1

let baseURL = 'https://itch.io/games/'
let scrapeURLS = ['tag-open-source', 'tag-github']

let itemsPerPage = 36
let maxPages
let nPages

let noResults = []

let promisesDone = 0

function scraper (url) {
  return new Promise(function (resolve, reject) {
    request(url.url, function (err, resp, body) {
      let percentage_progress = ((url.id * 100) / url.nPages).toFixed(0)

      function waitingPercent (p) {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        text =
          'Scraping progress for ' +
          url.url.substring(0, url.url.indexOf('?')) +
          ': ' +
          percentage_progress +
          '% of ' +
          url.maxPages +
          ' games.'
        process.stdout.write(text)
      }

      waitingPercent(percentage_progress)

      let $ = cheerio.load(body)

      let results = []

      if (err) {
        reject(err)
      } else {
        if ($('.game_cell').length) {
          $('.game_cell').each(function (i, elem) {
            let game = {}

            game.author = $(elem).find('.game_cell_data .game_author').text()
            game.author = game.author ? game.author : null

            game.description = $(elem).find('.game_cell_data .game_text').text()
            game.description = game.description ? game.description : null

            game.genre = $(elem).find('.game_cell_data .game_genre').text()
            game.genre = game.genre ? game.genre : null


            game.id = $(elem).attr('data-game_id')
            game.id = game.id ? game.id : null

            game.link = $(elem)
              .find('.game_cell_data .game_title .title.game_link')
              .attr('href')
            game.link = game.link ? game.link : null

            let platforms = []
            $(elem)
              .find('.game_cell_data .game_platform')
              .children()
              .each(function (i, elem) {
                let platform = $(elem).attr('title')
                if (platform) {
                  platform = platform.replace('Download for ', '')
                  platforms.push(platform)
                }
                let web_flag = $(elem).hasClass('web_flag')
                if (web_flag) {
                  platforms.push('HTML5')
                }
              })
            game.platforms = platforms.length ? platforms : null

            game.thumb = $(elem)
              .find('.game_thumb')
              .find('img')
              .attr('data-lazy_src')
            game.thumb = game.thumb ? game.thumb : null

            game.title = $(elem)
              .find('.game_cell_data .game_title .title.game_link')
              .text()
            game.title = game.title ? game.title : null

            game.video = $(elem)
              .find('.game_thumb .gif_overlay')
              .attr('data-gif')
            game.video = game.video ? game.video : null

            let scrapeWords = game.title
            // Remove special characters
            scrapeWords = scrapeWords.replace(
              /[&\/\\#,+()$~%.'":*!¡?¿<>{}@]/g,
              ''
            )
            // Separate camelCase words
            scrapeWords = scrapeWords.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            // Remove 'Demo' word
            scrapeWords = scrapeWords.replace(/demo/gi, '')
            // Create an array of words separated by spaces
            scrapeWords = scrapeWords.split(' ')
            // Remove some values from the array
            scrapeWords = scrapeWords.filter(function (el) {
              return el !== ('-' || '_')
            })
            // Remove booleans from array (null, undefined, false, '') but not the number '0'.
            scrapeWords = scrapeWords.filter(el => el === 0 || Boolean(el))

            game.scrapeWords = scrapeWords
            game.scrapeWords = scrapeWords.length ? scrapeWords : null

            results.push(game)
          })
        } else {
          noResults.push({ 'No results at index:': url.url })
        }

        resolve(results)
      }
    })
  })
}

function getAllGames () {
  mkdir(path.join(__dirname, '.tmp'))
  if (fs.existsSync(path.resolve('all.json'))) {
    fs.copyFileSync(path.resolve('all.json'), path.resolve('all-old.json'))
  }

  console.log('Scraping started ...')
  console.log()

  for (let i = 0; i < scrapeURLS.length; i++) {
    const scrapeURL = scrapeURLS[i]

    request(baseURL + scrapeURL, function (error, response, html) {
      if (!error) {
        let $ = cheerio.load(html)

        maxPages = parseInt(
          $('.game_count')
            .text()
            .match(/[0-9.,]+/g)[0]
            .replace(',', '')
        )

        nPages = Math.ceil(maxPages / itemsPerPage)
        // nPages = 1

        let urls = []
        for (let i = 1; i < nPages + 1; i++) {
          const url = baseURL + scrapeURL + '?page=' + i
          urls.push({
            id: i,
            maxPages: maxPages,
            nPages: nPages,
            url: url
          })
        }

        let scrapers = urls.map(scraper)

        Promise.all(scrapers).then(
          function (scrapes) {
            if (noResults.length) {
              console.log()
              console.log(noResults)
            }

            // "scrapes" collects the results from all pages.
            scrapes = flattenDeep(scrapes)

            writeJSON(scrapes, '.tmp/' + scrapeURL)

            promisesDone++

            if (promisesDone == scrapeURLS.length) {
              console.log('DONE!')

              let arr1 = readJSON('.tmp/' + scrapeURLS[0] + '.json')
              let arr2 = readJSON('.tmp/' + scrapeURLS[1] + '.json')

              arr1 = arr1.filter(item1 => arr2.some(item2 => item2.id === item1.id))

              let foo = new Map()
              for (const key of arr1) {
                foo.set(key.title, key)
              }
              let final = [...foo.values()]

              final = sortByKey(final, 'id')

              writeJSON(final, 'all')
            }
          },
          function (error) {
            // At least one of them went wrong.
            console.log('error', error)
          }
        )
      }
    })
  }
}

console.log(`
Update games
------------
`)

getAllGames()
