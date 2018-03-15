const Puppeteer = require('puppeteer');
const express = require('express');
const config = require('./config');

const app = express();
const port = config.Puppeteer.port;
const listen_address = config.Puppeteer.host;

app.use(express.json()); // for parsing application/json

const puppeteer = Puppeteer.launch({
    args: config.Puppeteer.args
})

process.on('exit', function(){
	puppeteer.close(); // Ensure that the browser process is stopped properly
})

async function getData(url, viewport, pageTimeout){
	const browser = await puppeteer
	const page = await browser.newPage();
	const resources = [];
	const consoleArray = [];

	console.log('Page created for url:', url);
	
	// Event - Push any console messages to consoleArray
	page.on('console', msg => {
		consoleArray.push( msg.text );
	});
	// page.on('request', msg =>{
	// 	console.log(msg); // Possible the key to line 38 - date/time of the request
	// });

	page.on('response', response => {
		// response.headers.date = new Date('response.headers.date').toISOString(); // FIXME - convert all date/time to round-trip date/time variant
		if (!response.url.startsWith("data:") && !response.url.startsWith("blank:")){ // Because apparently data/blank protocols are tagged as separate requests on Chrome
			resourceObject = { // Create Object for current resource
				"success": response.ok,
				"request":
				{
					"method": response._request['method'],
					"url": response._request['url'],
					"headers": response._request['headers'], //FIXME - Remove the date key/value from the 'headers' object
					"time": response['headers']['date'] //FIXME - The date/time of the request doesn't look available from the API, currently using the same as the response
				},
				"response":{
					"status": response['status'],
					"headers": response['headers'],
					"time": response['headers']['date']
				}
			};
			resources.push(resourceObject);
		}
	});

	await page.setViewport({width: viewport.width, height: viewport.height});
	await page.goto(url);
	const screenshot = Buffer.from(await page.screenshot({type: 'png', omitBackground: false })).toString('base64'); // FUTURE - Add the ability of selecting another mimetype from the POST data
	
	console.log('Page closed for url:', url);
	page.close()
	
	return {
		'request': {
			'url': url,
			'viewport': [viewport.width, viewport.height],
			'timeout': pageTimeout
		},
		'console': consoleArray,
		'image': screenshot,
		'resources': resources
	}
}
function handleError(res, reason, message, code) {
	console.log("ERROR: " + reason);
	res.status(code || 500).json({"error": message});
}

app.post('/request', function (req, res) {
	try{ // FIXME - Currently breaks when the required data (url,timeout,viewport) is not passed through POST
		if (!(req.body.url || req.body.timeout || isNaN(req.body.timeout))) {
			handleError(res, "Invalid URL and/or timeout", "Must provide the URL and timeout", 400);
		}
		let url = req.body.url;
		let pageTimeout = req.body.timeout;
		let viewportArry;
		try{
			viewportArry = JSON.parse(req.body.viewport);
			if (viewportArry.length != 2) {
				throw "Length of array is invalid: != 2";
			}
		}
		catch(e){
			handleError(res, "Couldn\'t parse viewport", "viewport: Must provide the following format [x,x]", 400);
		}

		let viewport = { width: viewportArry[0], height: viewportArry[1] };
		getData(url, viewport, pageTimeout).then(function(data) {
	        res.send(data);
	    });
	}
	catch(err){
		console.log(err);
	}
	
})

app.listen(port, listen_address, () => console.log('Puppeteer listening on ',listen_address,'port',port,'!'));
