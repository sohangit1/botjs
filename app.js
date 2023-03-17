// Binance Axios Market
require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const ejs = require('ejs');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const hostname = 'localhost';
const port = 8080;
let data = {};
let isFirstRun = true; // variable to track if the script has run before
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.post('/webhook', async (req, res) => {
    data = req.body;
    io.emit('update', data);
    console.log(`Received webhook with data: ${JSON.stringify(data)}`);
    try {
      const symbol = "BTCUSDT"; 
      const prev_market_position = data.strategy.prev_market_position;
      const size = parseFloat(data.strategy.prev_market_position_size).toFixed(4);
      const quantity = parseFloat(data.strategy.market_position_size).toFixed(4);
      const side = data.strategy.order_action.toUpperCase();
      console.log(size, quantity);

      if (!isFirstRun) { // only check previous market position if script has run before
        if (prev_market_position == "long") { // close the previous position if it exists
          const order = await newOrder(symbol, side, size, true);
          console.log(`Previous long position closed successfully: ${JSON.stringify(order)}`);
        }
        else if (prev_market_position == "short"){ // create a buy order to close the position
          const order = await newOrder(symbol, side, size, true)
          console.log(`Previous short position closed successfully: ${JSON.stringify(order)}`);
        }
      }

      if (data.strategy.order_action == "buy") { // create a buy order
        const order = await newOrder(symbol, side, quantity, false);
        console.log(`New long position opened successfully: ${JSON.stringify(order)}`);
      }
      else if(data.strategy.order_action == "sell"){ // create a sell order
        const order = await newOrder(symbol, side, quantity, false);
        console.log(`New short position opened successfully: ${JSON.stringify(order)}`);
        res.send({ success: true });
      }
      isFirstRun = false; // set the variable to false after the first run
    } catch (error) {
      console.error(`Failed to place order: ${error}`);
      res.send({ success: false, error });
    }
});
http.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});


app.get('/', (req, res) => {
    res.render('index', { data });
});

app.get('/data', (req, res) => {
  res.json(data);
});

io.on('connection', (socket) => {
  socket.emit('update', data);
});

async function newOrder(symbol, side, quantity, reduceOnly) {
  const data = {symbol, side, quantity, reduceOnly};
  data.type = "MARKET";
  data.timestamp = Date.now();

  const signature = crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(new URLSearchParams(data).toString())
    .digest("hex");

  data.signature = signature;

  return await axios({
    method: "POST",
    url: process.env.API_URL + "/fapi/v1/order?" + new URLSearchParams(data),
        headers: { "X-MBX-APIKEY": process.env.API_KEY }
    })
    .then(response => {
        console.log(response.data);
        return response.data;
    })
    .catch(error => {
        console.error(error);
        return false;
    });
  }