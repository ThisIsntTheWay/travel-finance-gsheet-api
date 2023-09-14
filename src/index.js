const express = require('express')
const moment = require('moment');
const { google } = require("googleapis");
const bodyParser = require('body-parser');

const app = express()
const port = 8080

app.use(bodyParser.json())
app.set('view engine', 'ejs')

// ------------[ VARIABLES ]
const requiredParams = [
  "item",
  "type",
  "date",
  "currency",
  "amount"
]

const optionalParams = [
  "notes",
  "beginning",
  "end",
  "location"
]

const expenseTypes = [
  "🚆 Transportation",
  "🏠 Accommodation",
  "🍔 Food",
  "🛒 Merchandise",
  "🖋️ Unclassified",
  "💸 Fees",
  "🎁 Souvenier",
  "🔑 Rental",
  "💰 Top up"
]

const currencies = {
  JPY: "¥",
  CHF: "CHF",
  EUR: "€",
  USD: "$"
}

const auth = new google.auth.GoogleAuth({
  keyFile: "creds.json",
  scopes: "https://www.googleapis.com/auth/spreadsheets", 
});

// Must keep this order
const expectedEnvVars = [
  "SHEET_ID",
  //"SHEET_SERVICE_ACCOUNT",
]

// =====================================
// ------------[ PRE FLIGHT ]
console.log("ENTERING PRE FLIGHT")

for (i in expectedEnvVars) {
  if (!process.env.hasOwnProperty(expectedEnvVars[i])) {
    throw new Error (`Must set env var: ${expectedEnvVars[i]}`)
  }
}

const spreadsheetId = process.env[expectedEnvVars[0]]
console.log("SPREADSHEET ID:", spreadsheetId)

// ------------[ FUNCTIONS ]
function formatDate(date) {
  const dateFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY'];

  let formattedDate = null;
  for (const formatString of dateFormats) {
    const parsedDate = moment(date, formatString, true);
    if (parsedDate.isValid()) {
      formattedDate = parsedDate.format('DD.MM.YYYY');
      break;
    }
  }

  return formattedDate;
}

// ------------[ ROUTES ]
app.get('/', function(req, res) {
  res.render('index', {
    expenseTypes: expenseTypes,
    currencies: currencies
  });
});

app.post('/sheet', async (req, res) => {
  if (!req.is('json')) {
    res.status(500).send("Expecting JSON")
    return
  }

  // Param validation
  let missingParams = []
  for (i in requiredParams) {
    const expectedParam = requiredParams[i]
    if (!req.body.hasOwnProperty(expectedParam) | req.body[expectedParam] === "") {
      missingParams.push(expectedParam)
    }
  }

  if (missingParams.length > 0) {
    res.status(400).json({ error: "Missing or empty params.", missingParams })
    return
  }

  // Try to push to sheet API
  try {
    const authClientObject = await auth.getClient();
    const googleSheetsInstance = google.sheets({ version: "v4", auth: authClientObject });

    // Optional params
    const optionalNotes = req.body["notes"] === "" ? null : req.body.notes
    const optionalBeginning = req.body["beginning"] === "" ? null : formatDate(req.body.beginning)
    const optionalEnd = req.body["end"] === "" ? null : formatDate(req.body.end)
    const optionalLocation = req.body["location"] === "" ? null : req.body.location

    const insertingValues = [
      req.body.item,
      req.body.type,
      req.body.date,
      null,
      optionalNotes,
      optionalLocation,
      req.body.currency,
      req.body.amount,
      null,
      optionalBeginning,
      optionalEnd,
    ]
    console.log("Inserting values:", insertingValues)

    // Determine last empty row based on data in column A
    await googleSheetsInstance.spreadsheets.values.get(
      {
        spreadsheetId,
        range: 'A:A', // Target column to determine last row with
      },
      (err, response) => {
        if (err) {
          console.error('The API returned an error:', err);
          return;
        }
  
        const values = response.data.values;
        const lastEmptyRowIndex = values.length + 1
  
        // Create the update request
        const updateRequest = {
          auth,
          spreadsheetId,
          range: `A${lastEmptyRowIndex}:K${lastEmptyRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          //insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [insertingValues]
          },
        };
  
        // Execute the update
        googleSheetsInstance.spreadsheets.values.update(updateRequest, (err, response) => {
          if (err) {
            console.error('The API returned an error:', err);
            res.status(500).json({ "system-error": err.message })
          } else {
            console.log('Data inserted successfully.');
            res.status(200).json({ success: true })
          }
        });
      }
    );
  } catch (error) {
    console.error(error)
    res.status(500).json({ "system-error": error.message })
    return
  }
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})