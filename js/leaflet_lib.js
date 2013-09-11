var LeafletLib = LeafletLib || {};
var LeafletLib = {

    latmin: 90,
    latmax: -90,
    lngmin: 180,
    lngmax: -180,
    searchRadius: 805,
    defaultCity: "",
    markers: [ ],
    geojson: [ ],
    leaflet_tracts: {},
    info: L.control(),

    initialize: function(element, features, centroid, zoom) {

        LeafletLib.map = L.map(element).setView(new L.LatLng( centroid[0], centroid[1] ), zoom);

        LeafletLib.tiles =  L.tileLayer('http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png', {
          attribution: 'Map data &copy; 2011 OpenStreetMap contributors, Imagery &copy; 2011 CloudMade',
          key: 'BC9A493B41014CAABB98F0471D759707',
          styleId: 22677
      }).addTo(LeafletLib.map);
        LeafletLib.map.attributionControl.addAttribution('LODES data &copy; <a href="http://census.gov/">US Census Bureau</a>');

        LeafletLib.info.onAdd = function (map) {
          this._div = L.DomUtil.create('div', 'info');
          this.update();
          return this._div;
        };

        LeafletLib.info.update = function (props) {
          this._div.innerHTML = (props ?
            '<strong>Census tract</strong>: ' + props.tract_fips: 'Hover over a census tract');
        };

        LeafletLib.info.addTo(LeafletLib.map);

        LeafletLib.geojson = L.geoJson(features, {
          style: LeafletLib.style,
          onEachFeature: LeafletLib.onEachFeature
        }).addTo(LeafletLib.map);

        LeafletLib.geojson.eachLayer(function (layer) {
          LeafletLib.leaflet_tracts[layer.feature.properties.tract_fips] = layer._leaflet_id;
        });

    },

    // get color depending on population density value
    getColor: function (d, jenks_cutoffs) {
      return  d >= jenks_cutoffs[3] ? '#006D2C' :
              d >= jenks_cutoffs[2] ? '#31A354' :
              d >= jenks_cutoffs[1] ? '#74C476' :
              d >= jenks_cutoffs[0] ? '#BAE4B3' :
                                      '#EDF8E9';
    },

    getColorTravelingFrom: function (d, jenks_cutoffs) {
      return  d >= jenks_cutoffs[3] ? '#A50F15' :
              d >= jenks_cutoffs[2] ? '#DE2D26' :
              d >= jenks_cutoffs[1] ? '#FB6A4A' :
              d >= jenks_cutoffs[0] ? '#FCAE91' :
                                      '#FEE5D9';
    },

    getColorTravelingTo: function (d, jenks_cutoffs) {
      return  d >= jenks_cutoffs[3] ? '#08519C' :
              d >= jenks_cutoffs[2] ? '#3182BD' :
              d >= jenks_cutoffs[1] ? '#6BAED6' :
              d >= jenks_cutoffs[0] ? '#BDD7E7' :
                                      '#EFF3FF';
    },

    style: function(feature) {
      return {
        weight: 0.5,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.7,
        fillColor: '#aaa' //getColor(feature.properties['2011']['total_jobs'], jenks_cutoffs)
      };
    },

    highlightFeature: function (e) {
      var layer = e.target;

      layer.setStyle({
        weight: 2,
        color: '#333',
        dashArray: '',
        fillOpacity: 0.7
      });

      if (!L.Browser.ie && !L.Browser.opera) {
        layer.bringToFront();
      }

      LeafletLib.info.update(layer.feature.properties);
    },

    resetHighlight: function (e) {

      e.target.setStyle({
        weight: 0.5,
        opacity: 1,
        color: 'white',
      });

      //geojson.resetStyle(e.target);
      LeafletLib.info.update();
    },

    getConnectedTracts: function (e) {

      var tract_fips = e.target.feature.properties.tract_fips;
      $.ajax({
        url: ("http://ec2-54-212-141-93.us-west-2.compute.amazonaws.com/tract-origin-destination/" + tract_fips + "/2011/"),
        type: 'GET',
        dataType: 'json',
        success: function (resp) {

          LeafletLib.geojson.eachLayer(function (layer) {
            LeafletLib.geojson.resetStyle(layer);
          });

          LeafletLib.displayOriginDestination(resp['traveling-to'], 'traveling-to');
          LeafletLib.displayOriginDestination(resp['traveling-from'], 'traveling-from');

        },
        error: function(error) {
            console.log(error);
        }  
      });
    },

    displayOriginDestination: function (tracts, type) {
      var jenks_numbers = [];
      $.each(tracts, function(index, value) {
        $.each(value, function(k, v) {
          jenks_numbers.push(v);
        });
      });

      var tract_jenks_cutoffs = jenks(jenks_numbers, 4);
      tract_jenks_cutoffs[0] = 0; // ensure the bottom value is 0
      tract_jenks_cutoffs.pop(); // last item is the max value, so dont use it

      $.each(tracts, function(index, value) {
        $.each(value, function(k, v) {
          console.log(k);
          if (LeafletLib.leaflet_tracts[k] != undefined)
            if (type == 'traveling-to')
              LeafletLib.map._layers[LeafletLib.leaflet_tracts[k]].setStyle({fillColor: LeafletLib.getColorTravelingTo(v, tract_jenks_cutoffs)});
            else
              LeafletLib.map._layers[LeafletLib.leaflet_tracts[k]].setStyle({fillColor: LeafletLib.getColorTravelingFrom(v, tract_jenks_cutoffs)});
        });
      });

    },

    onEachFeature: function (feature, layer) {
      layer.on({
        mouseover: LeafletLib.highlightFeature,
        mouseout: LeafletLib.resetHighlight,
        click: LeafletLib.getConnectedTracts
      });
    },

    addBoundedPoint: function( latlng ){
        LeafletLib.latmin = Math.min( LeafletLib.latmin, latlng.lat );
        LeafletLib.latmax = Math.max( LeafletLib.latmax, latlng.lat );
        LeafletLib.lngmin = Math.min( LeafletLib.lngmin, latlng.lng );
        LeafletLib.lngmax = Math.max( LeafletLib.lngmax, latlng.lng );
    },

    addBoundedBox: function( bounds ){
        LeafletLib.latmin = Math.min( LeafletLib.latmin, bounds.getSouthWest().lat );
        LeafletLib.latmax = Math.max( LeafletLib.latmax, bounds.getNorthEast().lat );
        LeafletLib.lngmin = Math.min( LeafletLib.lngmin, bounds.getSouthWest().lng );
        LeafletLib.lngmax = Math.max( LeafletLib.lngmax, bounds.getNorthEast().lng );
    },

    fitFeatures: function(){
        if(LeafletLib.latmax > LeafletLib.latmin){
          var bounds = new L.LatLngBounds(
                      new L.LatLng( LeafletLib.latmin, LeafletLib.lngmin ),
                      new L.LatLng( LeafletLib.latmax, LeafletLib.lngmax ));

          LeafletLib.map.fitBounds( bounds.pad(.2) );
        }
    },

    squareAround: function(latlng, distance){
        var north = latlng.lat + distance * 0.000008;
        var south = latlng.lat - distance * 0.000008;
        var east = latlng.lng + distance * 0.000009;
        var west = latlng.lng - distance * 0.000009;
        var bounds = [[south, west], [north, east]];
        var sq = new L.rectangle(bounds);
        return sq;
    },

    searchAddress: function(address){
        if(LeafletLib.defaultCity && LeafletLib.defaultCity.length){
          var checkaddress = address.toLowerCase();
          var checkcity = LeafletLib.defaultCity.split(",")[0].toLowerCase();
          if(checkaddress.indexOf(checkcity) == -1){
            address += ", " + LeafletLib.defaultCity;
          }
        }
        var s = document.createElement("script");
        s.type = "text/javascript";
        s.src = "http://nominatim.openstreetmap.org/search/" + encodeURIComponent(address) + "?format=json&json_callback=LeafletLib.returnAddress";
        document.body.appendChild(s);
    },

    drawSquare: function(foundLocation, searchRadius){
        LeafletLib.sq = LeafletLib.squareAround(foundLocation, searchRadius);
        LeafletLib.sq.setStyle({
          strokeColor: "#4b58a6",
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: "#4b58a6",
          fillOpacity: 0.1
        });
        LeafletLib.map.addLayer(LeafletLib.sq);

        LeafletLib.centerMark = new L.Marker(foundLocation, { icon: (new L.Icon({
          iconUrl: '/assets/blue-pushpin.png',
          iconSize: [32, 32],
          iconAnchor: [10, 32]
        }))}).addTo(LeafletLib.map);
    },

    returnAddress: function(response){
        //console.log(response);
        if(!response.length){
          alert("Sorry, no results found for that location.");
          return;
        }

        var first = response[0];
        var foundLocation = new L.LatLng(first.lat, first.lon);
        if(typeof LeafletLib.sq != "undefined" && LeafletLib.sq){
          LeafletLib.map.removeLayer(LeafletLib.sq);
          LeafletLib.map.removeLayer(LeafletLib.centerMark);
        }

        LeafletLib.drawSquare(foundLocation, LeafletLib.searchRadius);

        LeafletLib.filterMarkers( { rectangle: LeafletLib.sq } );

        LeafletLib.map.fitBounds( LeafletLib.sq.getBounds().pad(0.2) );
    },

    addMarker: function( marker ){
        LeafletLib.map.addLayer(marker);
        LeafletLib.addBoundedPoint( marker.getLatLng() );
        LeafletLib.markers.push( marker );
    },

    ptInShape: function( pt, shape ){
        if( typeof shape.rectangle != "undefined" ){
          var bounds = shape.rectangle.getBounds();
          if(pt.lat < bounds.getNorthEast().lat && pt.lat > bounds.getSouthWest().lat && pt.lng < bounds.getNorthEast().lng && pt.lng > bounds.getSouthWest().lng){
            return true;
          }
          return false;
        }
        else if( typeof shape.circle != "undefined" ){
          // getRadius is in meters, makes this more complex
        }
        else if( typeof shape.polygon != "undefined" ){
          var poly = shape.polygon.getLatLngs();
          for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i){
            ((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) || (poly[j].lat <= pt.lat && pt.lat < poly[i].lat))
            && (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng)
            && (c = !c);
          }
          return c;
       }
    },

    filterMarkers: function( boundary ){
        for(var m=0;m<LeafletLib.markers.length;m++){
          var ll = LeafletLib.markers[m].getLatLng();
          if(LeafletLib.ptInShape(ll, boundary)){
            if( !LeafletLib.map.hasLayer( LeafletLib.markers[m] ) ){
              LeafletLib.map.addLayer( LeafletLib.markers[m] );
            }
          }
          else{
            LeafletLib.map.removeLayer( LeafletLib.markers[m] );
          }
        }
    },

    geolocate: function(alt_callback){
        // Try W3C Geolocation
        var foundLocation;
        if(navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(position) {

            if(typeof alt_callback != "undefined"){
              alt_callback( position );
            }
            else{

              foundLocation = new L.LatLng(position.coords.latitude * 1.0, position.coords.longitude * 1.0);

              if(typeof LeafletLib.sq != "undefined" && LeafletLib.sq){
                LeafletLib.map.removeLayer(LeafletLib.sq);
                LeafletLib.map.removeLayer(LeafletLib.centerMark);
              }

              LeafletLib.drawSquare(foundLocation, LeafletLib.searchRadius);

              LeafletLib.filterMarkers( { rectangle: LeafletLib.sq } );

              LeafletLib.map.fitBounds( LeafletLib.sq.getBounds().pad(0.2) );
            }
          }, null);
        }
        else {
          alert("Sorry, we could not find your location.");
        }
    }
}