const express = require('express');
const cors = require('cors');
const request = require('request');
const fs = require('node:fs')
const axios = require('axios');
const vhost = require('vhost');
const path = require('path');
const PDFDocument = require("pdfkit-table");

const GtfsRealtimeBindings = require('gtfs-realtime-bindings').transit_realtime;

const utilityBus = require('./homeMadeModules/utilityBus');

const app = express();
  app.use(cors({
    origin: '*'
  })
);

const apiDoc = {
  message: 'Bienvenue sur une API de données des bus de l\'agglomération de Castres-Mazamet',
  author: {
    "name": "Alexis RARCHAERT",
    "email": "bonjour@alexis-rarchaert.fr",
    "website": "https://alexis-rarchaert.fr"
  },
  version: '1.0.0',
  data: {
    "static": [
      {
        name: 'routes',
        description: 'Récupère les lignes de bus',
        method: 'GET',
        endpoint: '/routes'
      },
      {
        name: 'routeInfos',
        description: 'Récupère les informations d\'une ligne de bus',
        method: 'GET',
        endpoint: '/routes/:routeId'
      },
      {
        name: 'shapes',
        description: 'Récupère les shapes des bus',
        method: 'GET',
        endpoint: '/shapes'
      },
      {
        name: 'stopTimes',
        description: 'Récupère les horaires de passage aux arrêts',
        method: 'GET',
        endpoint: '/stop_times'
      },
      {
        name: 'stops',
        description: 'Récupère les arrêts de bus',
        method: 'GET',
        endpoint: '/stops'
      },
      {
        name: 'trips',
        description: 'Récupère les voyages des bus',
        method: 'GET',
        endpoint: '/trips'
      },
      {
        name: 'calendar',
        description: 'Récupère le calendrier des bus',
        method: 'GET',
        endpoint: '/calendar'
      },
      {
        name: 'stopInfos',
        description: 'Récupère les informations d\'un arrêt de bus',
        method: 'GET',
        endpoint: '/stops/:stopId'
      },
      {
        name: 'linesThroughStop',
        description: 'Récupère les lignes passant par un arrêt de bus',
        method: 'GET',
        endpoint: '/stops/:stopId/lines'
      },
      {
        name: 'nextBusesStop',
        description: 'Récupère les prochains bus à un arrêt de bus',
        method: 'GET',
        endpoint: '/stops/:stopId/nextBuses'
      },
      {
        name: 'stopsForTrip',
        description: 'Récupère les arrêts d\'un voyage de bus',
        method: 'GET',
        endpoint: '/trips/:tripId/stops'
      },
      {
        name: 'tripDuration',
        description: 'Récupère la durée d\'un voyage de bus',
        method: 'GET',
        endpoint: '/trips/:tripId/duration'
      },
      {
        name: 'tripsThroughStop',
        description: 'Récupère les trajets qui passent par un arrêt de bus',
        method: 'GET',
        endpoint: '/tripsThroughStop/:stopId'
      }
    ],
    "realtime": [
      {
        name: 'gtfs-rt',
        description: 'Récupère les données GTFS-RT brutes des bus de l\'agglomération de Castres-Mazamet',
        method: 'GET',
        endpoint: '/gtfs-rt'
      },
      {
        name: 'delays',
        description: 'Récupère les retards et les avance des bus de l\'agglomération de Castres-Mazamet par rapport à l\'horaire prévu',
        method: 'GET',
        endpoint: '/delays'
      }
    ],
    "pdf": [
      {
        name: 'generateLatePDF',
        description: 'Génère un fichier PDF contenant les retards et les avances des bus de l\'agglomération de Castres-Mazamet par rapport à l\'horaire prévu',
        method: 'GET',
        endpoint: '/generateLatePDF'
      }
    ]
  }
}

const getGtfsRt = async (req, res) => {
  let requestSettings = {
    method: 'GET',
    url: 'https://www.data.gouv.fr/fr/datasets/r/3fdc110c-a929-4d31-bf3a-0f12eb3f1806',
    encoding: null
  };

  request(requestSettings, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      let feed = GtfsRealtimeBindings.FeedMessage.decode(body);
      res.json(feed);
    } else {
      res.status(500).send('Error retrieving GTFS-RT data');
    }
  });
};

app.get('/gtfs-rt', getGtfsRt);

app.get('/delays', async (req, res) => {
  try {
    let requestSettings = {
      method: 'GET',
      url: 'https://www.data.gouv.fr/fr/datasets/r/3fdc110c-a929-4d31-bf3a-0f12eb3f1806',
      encoding: null
    };
  
    await request(requestSettings, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        feed = GtfsRealtimeBindings.FeedMessage.decode(body);

        if(!feed.entity) {
          let rep = {
            message: 'No data',
            status: 404
          }
          return res.status(500).send(rep);
        }

        let data = feed.entity;
        let stop_times = JSON.parse(fs.readFileSync(__dirname + '/json_data/stop_times.json', 'utf8'));

        var vehicles = [];
        var tripUpdates = [];

        data.forEach((entity) => {
          if(entity.vehicle) {
            vehicles.push(entity.vehicle);
          }
        });

        data.forEach((entity) => {
          if(entity.tripUpdate) {
            tripUpdates.push(entity.tripUpdate);
          } 
        });

        let delays = [];

        for(let i = 0; i < vehicles.length; i++) {
          if(vehicles[i] != "" && tripUpdates[i] != "") {
            try {
              let tripId = tripUpdates[i].trip.tripId;
              let currentStopId = vehicles[i]?.stopId || null;
              let currentStatus = vehicles[i]?.currentStatus || null;

              let stopTime = stop_times.find(stop_time => stop_time.trip_id === tripId && stop_time.stop_id === currentStopId);

              if(stopTime) {
                let scheduledArrival = stopTime.departure_time;
                
                scheduledArrival = scheduledArrival.split(':');
                
                now = new Date();
                scheduledArrival = new Date(now.getFullYear(), now.getMonth(), now.getDate(), scheduledArrival[0], scheduledArrival[1], scheduledArrival[2]);
                scheduledArrival = Math.floor(scheduledArrival.getTime()/1000);

                vehicles[i].scheduledArrival = scheduledArrival;
                let actualArrival = vehicles[i].timestamp;
                vehicles[i].actualArrival = actualArrival;

                let rawDelay = actualArrival - scheduledArrival;

                delays.push({
                  tripId: tripId,
                  stopId: currentStopId,
                  currentStopSequence: tripUpdates[i].stopTimeUpdate[0].stopSequence,
                  currentStatut: currentStatus,
                  lineName: utilityBus.getLineName(tripUpdates[i].trip.routeId),
                  stopName: utilityBus.getStopName(currentStopId),
                  delay: rawDelay,
                  last_update: vehicles[i].timestamp
                })
              } else {
                console.log('No stop time found for trip ' + tripId + ' and stop ' + currentStopId);
              }
            } catch (error) {
              console.error("Error:", error);
              res.status(500).send('Error retrieving delay data: ' + error);
            }
          }
        }

        res.json(delays);
      } else {
        res.status(500).send('Error retrieving delay data');
      }
    });


  } catch (error) {
    console.error("Error:", error);
    res.status(500).send('Error retrieving delay data');
  }
});


//On ajoute une route pour afficher les lignes des bus
app.get('/routes', (req, res) => {
  res.sendFile(__dirname + '/json_data/routes.json');
});

//On ajoute une route pour afficher les informations d'une ligne
app.get('/routes/:routeId', (req, res) => {
  const routeInfos = utilityBus.getRouteInfos(req.params.routeId);
  res.json(routeInfos);
});

//On ajoute une route pour afficher les shapes des bus
app.get('/shapes', (req, res) => {
  res.sendFile(__dirname + '/json_data/shapes.json');
});

const getStopTimes = async (req, res) => {
  res.sendFile(__dirname + '/json_data/stop_times.json');
};
//On ajoute une route pour afficher les stop_times des bus
app.get('/stop_times', getStopTimes);

//On ajoute une route pour afficher les stops des bus
app.get('/stops', (req, res) => {
  res.sendFile(__dirname + '/json_data/stops.json');
});

//On ajoute une route pour afficher les trips des bus
app.get('/trips', (req, res) => {
  res.sendFile(__dirname + '/json_data/trips.json');
});

//On ajoute une route pour afficher le calendrier des bus
app.get('/calendar', (req, res) => {
  res.sendFile(__dirname + '/json_data/calendar.json');
});

// On ajoute une route pour afficher les informations d'un arrêt
app.get('/stops/:stopId', (req, res) => {
  const stopInfos = utilityBus.getStopsInfos(req.params.stopId);
  res.json(stopInfos);
});

// On ajoute une route pour afficher les lignes passant par un arrêt
app.get('/stops/:stopId/lines', (req, res) => {
  const lines = utilityBus.getLinesThroughStop(req.params.stopId);
  res.json(lines);
});

// On ajoute une route pour afficher les prochains bus à un arrêt
app.get('/stops/:stopId/nextBuses', (req, res) => {
  const nextBuses = utilityBus.getNextBusesStop(req.params.stopId);
  res.json(nextBuses);
});

// On ajoute une route pour afficher les arrêts d'un voyage
app.get('/trips/:tripId/stops', (req, res) => {
  const stops = utilityBus.getStopsForTrip(req.params.tripId);
  res.json(stops);
});

// On ajoute une route pour afficher la durée d'un voyage
app.get('/trips/:tripId/duration', (req, res) => {
  const duration = utilityBus.getTripsDuration(req.params.tripId);
  res.json(duration);
});

//On créé une route pour chercher les trajets qui passent par un arrêt
app.get('/tripsThroughStop/:stopId', (req, res) => {
  const trips = utilityBus.getTripsThroughStop(req.params.stopId);
  const parsedTrips = [];
  //On loop les trajets et on utilise la fonction getLineInfos pour récupérer les infos de la ligne
  trips.forEach(trip => {
    const routeInfos = utilityBus.getLineInfos(trip);
    const rep = {
      routeInfos: routeInfos,
      trip: utilityBus.getTripInfos(trip)
    }
    parsedTrips.push(rep);
  });

  res.json(parsedTrips);
});

//On créé une route qui permet de créer un fichier PDF pour créer un justificatif de retard
app.get('/generateLatePDF', (req, res) => {
  const directoryPath = path.join(__dirname, '/saved_lates/');

  //On récupère le dernier fichier dans le dossier /saved_lates/
  fs.readdir(directoryPath, function (err, files) {
    if(err) {
      return console.error('Unable to scan directory: ' + err);
    }

    files.sort(function(a, b) {
      return fs.statSync(directoryPath + b).mtime.getTime() - fs.statSync(directoryPath + a).mtime.getTime();
    });

    const latestFile = files[0];
    fs.readFile(directoryPath + latestFile, 'utf8', async function(err, data) {
      if (err) {
        return console.log('Unable to read file: ' + err);
      }

      data = JSON.parse(data);
      let rep = [];
  
      for (var i = 0; i < data.length; i++) {

        const today = new Date();
        const lastUpdateTime = data[i].last_update.low;
        if((today.getTime()/1000 - 600) < lastUpdateTime) {
          rep.push({
            tripId: data[i].tripId,
            stopId: data[i].stopId,
            lineName: data[i].lineName,
            stopName: data[i].stopName,
            delay: data[i].delay,
            headsign: utilityBus.getTripInfos(data[i].tripId).trip_headsign
          });
        }
      }

      let date = latestFile.split('-');

      if(rep.length === 0) {
        await res.sendFile(__dirname + '/rapport_retards.pdf');
        return;
      } else {
        generatePDF(`${date[0]}/${date[1]}/${date[2]}`, date[3], date[4].replace(".json", ""), rep);
        await res.sendFile(__dirname + '/rapport_retards.pdf');
        return;
      }


    });
  });
});

// On ajoute une route pour afficher la documentation de l'API
app.get('/', (req, res) => {
  res.json(apiDoc);
});

// On lance le serveur sur le port 3000
app.listen(3000, () => {
  console.log('Server is running port 3000');
});

async function saveRetards() {
  const today = new Date();
  const day = today.getDay();

  if(day === 0) {
    console.info('It\'s Sunday, no buses today');
    return;
  } else {
    console.info('Saving delays...');

    let requestSettings = {
      method: 'GET',
      url: 'http://api.libellus.alexis-rarchaert.fr/delays',
      encoding: null
    };

    console.info('Requesting delays...');

    await request(requestSettings, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        let data = JSON.parse(body);

        const date = new Date();
        const fileName = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear() + '-' + date.getHours() + '-' + date.getMinutes() + '.json';

        if(data.length === 0) {
          console.info('No delays to save');
          return;
        } else {
          console.info('Delays to save:', data.length);
          fs.writeFile(__dirname + '/saved_lates/' + fileName, JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log('Delays saved in ' + fileName + ' !');
          });
        }
        
      } else {
        console.error("Error:", error);
      }
    })
  }
}

function generatePDF(date, heure, minutes, busData) {
  const doc = new PDFDocument({margin: 50});
  doc.pipe(fs.createWriteStream('rapport_retards.pdf'));

  // Titre centré
  doc.fontSize(20).font('Helvetica').text('Rapport d\'horaires', { align: 'center' }).moveDown();

  // Informations sur la date et l'heure
  doc.fontSize(10).text(`Table des horaires des bus de l'agglomération de Castres-Mazamet le ${date}, à ${heure} heures et ${minutes} minutes.`, { align: 'center' }).moveDown();

  // Tableau des retards
  const table = {
      headers: ['Ligne', 'Destination', 'Retard'],
      rows: busData.map(bus => [bus.lineName, bus.headsign, 
        `${(Math.floor(bus.delay / 60) === 0) ? "A l'heure" :
        (Math.floor(bus.delay / 60) < 0) ? `Avance ${Math.floor(bus.delay / 60).toString().replace("-", "")}` :
        `Retard ${Math.floor(bus.delay / 60)}`} minutes`
      ])
    
      //rows: busData.map(bus => [bus.lineName, bus.headsign, `${(Math.floor(bus.delay / 60) < 0) ? `Avance ${Math.floor(bus.delay / 60).toString().replace("-", "")}` : `Retard ${Math.floor(bus.delay / 60)}`} minutes`])
  };
  doc.table(table, { width: 500, height: 200, prepareHeader: () => doc.font('Helvetica-Bold'), prepareRow: (row, i) => doc.font('Helvetica').fontSize(10) });

  // Mention en bas de page
  doc.text('Ce présent document n\'a aucune valeur, mais peut être utilisé pour prouver votre bonne foi. Il vous restera à démontrer votre présence dans le bus.', { align: 'center' });

  doc.fontSize(30).fillOpacity(0.2).fillColor('gray');
  doc.text("https://libellus.alexis-rarchaert.fr", { align: 'center', valign: 'center' });

  const currentDate = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const currentTime = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(10).fillOpacity(1).fillColor("black").text(`Généré automatiquement le ${currentDate} à ${currentTime}, avec les données du ${date} à ${heure}:${minutes}\nLibellus.alexis-rarchaert.fr - En aucun cas lié à l'agglomération de Castres-Mazamet ou à la ville de Castres.`, 50, doc.page.height - 100);
    }

  doc.end();
}

setTimeout(() => {
  saveRetards();
}, 5000);

//Toutes les 5 minutes, on sauvegarde les retards 
setInterval(() => {
  saveRetards();
}, 300000);