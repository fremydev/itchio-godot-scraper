const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Read the JSON file containing the links
fs.readFile('all.json', 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading the JSON file:', err);
    return;
  }

  try {
    // Parse the JSON data
    const linksArray = JSON.parse(data);

    // Store all the hrefs from the pages
    let allHrefs = [];

    // Iterate over each link in the array
    for (const item of linksArray) {
      const link = item.link;
      console.log(`Fetching links from: ${link}`);

      // Fetch the page content
      const response = await axios.get(link);
      const $ = cheerio.load(response.data);

      // Extract all href attributes from <a> elements
      let game = {}
      game.name = item.title
      game.link = link
      game.all_links = []
      $('a').each((index, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('github')) {
          game.all_links.push(href);
        }
      });
      allHrefs.push(game)
    }

    // Write the collected hrefs to an output text file
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
