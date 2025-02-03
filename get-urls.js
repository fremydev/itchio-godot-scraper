const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

fs.readFile('all.json', 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading the JSON file:', err);
    return;
  }
  try {
    const linksArray = JSON.parse(data);

    let allHrefs = [];

    for (const item of linksArray) {
      const link = item.link;
      console.log(`Fetching links from: ${link}`);

      const response = await axios({
        method: 'get',
        url: link,
        timeout: 20000,
      });
      const $ = cheerio.load(response.data);

      let game = {}
      game.all_links = []
      $('a').each((index, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('github') && !href.includes('tag-github')) {
          game.all_links.push(href);
        }
      });
      if (game.all_links.length > 0){
        game.name = item.title
        game.link = link
        game.number_comments = $('.community_post_list_widget').length
        game.metadata = item.tbody
        allHrefs.push(game);
      }
    }

    const outputFile = 'output_links.json';
    fs.writeFile(outputFile, JSON.stringify(allHrefs, null, 2), (err) => {
      if (err) {
        console.error('Error writing the output file:', err);
      } else {
        console.log(`Successfully wrote hrefs to ${outputFile}`);
      }
    });

  } catch (err) {
    console.error('Error processing the JSON or fetching links:', err);
  }
});
