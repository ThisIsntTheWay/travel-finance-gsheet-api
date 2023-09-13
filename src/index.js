const express = require('express')
const { google } = require("googleapis");
const bodyParser = require('body-parser');

const app = express()
const port = 3000

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
  "end"
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
    if (!req.body.hasOwnProperty(expectedParam)) {
      missingParams.push(expectedParam)
    }
  }

  if (missingParams.length > 0) {
    res.status(400).json({ error: "Missing parameters.", missingParams })
    return
  }

  // Try to push to sheet API
  try {
    const authClientObject = await auth.getClient();
    const googleSheetsInstance = google.sheets({ version: "v4", auth: authClientObject });

    // Optional params
    const optionalNotes = req.body.hasOwnProperty("notes") ? req.body.notes : ''
    const optionalBeginning = req.body.hasOwnProperty("beginning") ? req.body.beginning : ''
    const optionalEnd = req.body.hasOwnProperty("end") ? req.body.end : ''

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
          range: `A${lastEmptyRowIndex}:J${lastEmptyRowIndex}`,
          valueInputOption: 'USER_ENTERED',
          //insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              req.body.item,
              req.body.type,
              req.body.date,
              null,
              optionalNotes,
              req.body.currency,
              req.body.amount,
              null,
              optionalBeginning,
              optionalEnd
            ]]
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