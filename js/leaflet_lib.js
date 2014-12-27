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
    selectedTract: "17031839100",
    viewMode: 'traveling-to',
    legend: L.control({position: 'bottomright'}),

    initialize: function(element, features, centroid, zoom) {

      LeafletLib.map = L.map(element).setView(new L.LatLng( centroid[0], centroid[1] ), zoom);

      LeafletLib.tiles =  L.tileLayer('https://{s}.tiles.mapbox.com/v3/datamade.hn83a654/{z}/{x}/{y}.png', {
          attribution: '<a href="http://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>'
      }).addTo(LeafletLib.map);

      LeafletLib.map.attributionControl.addAttribution('LODES data &copy; <a href="http://census.gov/">US Census Bureau</a>');

      LeafletLib.geojson = L.geoJson(features, {
        style: LeafletLib.style,
        onEachFeature: LeafletLib.onEachFeature
      }).addTo(LeafletLib.map);

      LeafletLib.geojson.eachLayer(function (layer) {
        LeafletLib.leaflet_tracts[layer.feature.properties.tract_fips] = layer._leaflet_id;
        layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips);
      });

      if ($.address.parameter('tract_fips') != undefined)
      LeafletLib.selectedTract = $.address.parameter('tract_fips');

      if ($.address.parameter('view_mode') == 'traveling-from') {
        LeafletLib.viewMode = 'traveling-from';
        $('#rbTravelingFrom').attr('checked', 'checked');
      }

      LeafletLib.getConnectedTracts(LeafletLib.selectedTract);
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
    },

    resetHighlight: function (e) {

      //if (e.target.feature.properties.tract_fips != LeafletLib.selectedTract) {
         e.target.setStyle({
          weight: 0.5,
          opacity: 1,
          color: 'white',
        });
      //}
    },

    tractSelected: function (e) {
      var tract_fips = e.target.feature.properties.tract_fips;
      LeafletLib.selectedTract = tract_fips;
      $.address.parameter('tract_fips',tract_fips);

      LeafletLib.getConnectedTracts(tract_fips);
    },

    getConnectedTracts: function (tract_fips) {

      $( "#selected-tract" ).fadeOut(function() {
          $( "#selected-tract-id" ).html(tract_fips);
        });
      $( "#selected-tract" ).fadeIn();

      LeafletLib.map.panTo(LeafletLib.map._layers[LeafletLib.leaflet_tracts[tract_fips]]._latlngs[0]);

      $.ajax({
        url: ("https://s3-us-west-2.amazonaws.com/census-lodes/2011/" + tract_fips + ".json"),
        type: 'GET',
        dataType: 'json',
        success: function (resp) {

          LeafletLib.geojson.eachLayer(function (layer) {
            LeafletLib.geojson.resetStyle(layer);
            layer.unbindLabel();
            layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips);
          });

          LeafletLib.displayOriginDestination(resp[LeafletLib.viewMode], LeafletLib.viewMode);
          LeafletLib.map._layers[LeafletLib.leaflet_tracts[tract_fips]].setStyle({fillColor: '#4A1486'});
        },
        error: function(error) {
          console.log(error);
        }
      });
    },

    displayOriginDestination: function (tracts, type) {
      var jenks_numbers = [];
      var top_tracts = "";
      var total_workers = 0;
      var index = 0
      $.each(tracts, function(tract, value) {
        index += 1
        jenks_numbers.push(value);
        total_workers += value;

        if (index < 5) top_tracts += "<tr><td><a onclick='LeafletLib.getConnectedTracts(" + tract + "); return false;' href='#'>" + tract + "</a></td><td>" + LeafletLib.addCommas(value) + "</td></tr>";
      });

      $('#connect-tracts').html(LeafletLib.addCommas(index));
      $('#total-workers').html(LeafletLib.addCommas(total_workers));
      $('#top-tracts tbody').html(top_tracts);

      var tract_jenks_cutoffs = jenks(jenks_numbers, 4);
      //console.log(tract_jenks_cutoffs);

      if (tract_jenks_cutoffs == null)
        LeafletLib.updateLegend([], null, "No workers");
      else {
        if (type == 'traveling-to') {
          $('#inbound-outbound').html("inbound");
          LeafletLib.updateLegend(tract_jenks_cutoffs, LeafletLib.getColorTravelingTo, "Inbound workers");
        }
        else {
          $('#inbound-outbound').html("outbound");
          LeafletLib.updateLegend(tract_jenks_cutoffs, LeafletLib.getColorTravelingFrom, "Outbound workers");
        }

        $.each(tracts, function(tract, value) {
          //console.log(k);
          if (LeafletLib.leaflet_tracts[tract] != undefined) {

            var layer = LeafletLib.map._layers[LeafletLib.leaflet_tracts[tract]];
            if (type == 'traveling-to') {
              layer.setStyle({fillColor: LeafletLib.getColorTravelingTo(value, tract_jenks_cutoffs)});
              layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips + "<br />Inbound workers: " + value);
            }
            else {
              LeafletLib.map._layers[LeafletLib.leaflet_tracts[tract]].setStyle({fillColor: LeafletLib.getColorTravelingFrom(value, tract_jenks_cutoffs)});
              layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips + "<br />Outbound workers: " + value);
            }
          }
        });
      }

    },

    updateLegend: function(tract_jenks_cutoffs, color_function, legend_title) {

      if (LeafletLib.legend.onAdd != undefined)
        LeafletLib.map.removeControl(LeafletLib.legend);

      LeafletLib.legend.onAdd = function (map) {

          var div = L.DomUtil.create('div', 'info legend'),
              grades = tract_jenks_cutoffs,
              labels = [],
              from, to;

          for (var i = 0; i < grades.length; i++) {
              from = grades[i];
              to = grades[i + 1];

              if (to) {
                labels.push(
                  '<i style="background:' + color_function((from + 0.01), tract_jenks_cutoffs) + '"></i> ' +
                  from + '&ndash;' + to);
              }
          }

          div.innerHTML = "<strong>"+ legend_title + "</strong><br>" + labels.join('<br>');
          return div;
      };

      LeafletLib.legend.addTo(LeafletLib.map);
    },

    onEachFeature: function (feature, layer) {
      layer.on({
        mouseover: LeafletLib.highlightFeature,
        mouseout: LeafletLib.resetHighlight,
        click: LeafletLib.tractSelected
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
    },

    addCommas: function(nStr) {
      nStr += '';
      x = nStr.split('.');
      x1 = x[0];
      x2 = x.length > 1 ? '.' + x[1] : '';
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      }
      return x1 + x2;
    }
}
