var LeafletLib = LeafletLib || {};
var LeafletLib = {

    latmin: 40.7365,
    latmax: 42.6699,
    lngmin: -88.9423,
    lngmax: -86.9294,
    searchRadius: 805,
    defaultCity: "",
    markers: [ ],
    geojson: [ ],
    leaflet_tracts: {},
    jenks_counts: {},
    selectedTract: "17031839100",
    viewMode: 'traveling-to',
    legend: L.control({position: 'bottomright'}),

    initialize: function(element, features, centroid, zoom, counts) {
      LeafletLib.jenks_counts = counts;

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

    //if ($.address.parameter('view_mode') == 'traveling-from') {
    //  LeafletLib.viewMode = 'traveling-from';
    //  $('#rbTravelingFrom').attr('checked', 'checked');
    //}

    //LeafletLib.getConnectedTracts(LeafletLib.selectedTract);
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
        fillColor: LeafletLib.getColorTravelingTo(feature.properties['traveling-to'], LeafletLib.jenks_counts['traveling_to'])
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
      $.each(tracts, function(index, value) {
        $.each(value, function(k, v) {
          jenks_numbers.push(v);
          total_workers += v;

          if (index < 5) top_tracts += "<tr><td><a onclick='LeafletLib.getConnectedTracts(" + k + "); return false;' href='#'>" + k + "</a></td><td>" + LeafletLib.addCommas(v) + "</td></tr>";
        });
      });

      $('#connect-tracts').html(LeafletLib.addCommas(tracts.length));
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

        $.each(tracts, function(index, value) {
          $.each(value, function(k, v) {
            //console.log(k);
            if (LeafletLib.leaflet_tracts[k] != undefined) {

              var layer = LeafletLib.map._layers[LeafletLib.leaflet_tracts[k]];
              if (type == 'traveling-to') {
                layer.setStyle({fillColor: LeafletLib.getColorTravelingTo(v, tract_jenks_cutoffs)});
                layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips + "<br />Inbound workers: " + v);
              }
              else {
                LeafletLib.map._layers[LeafletLib.leaflet_tracts[k]].setStyle({fillColor: LeafletLib.getColorTravelingFrom(v, tract_jenks_cutoffs)});
                layer.bindLabel('Tract: ' + layer.feature.properties.tract_fips + "<br />Outbound workers: " + v);
              }
            }
          });
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

    searchAddress: function(e){
        e.preventDefault();
        var address = $('#address').val();
        if(LeafletLib.defaultCity && LeafletLib.defaultCity.length){
          var checkaddress = address.toLowerCase();
          var checkcity = LeafletLib.defaultCity.split(",")[0].toLowerCase();
          if(checkaddress.indexOf(checkcity) == -1){
            address += ", " + LeafletLib.defaultCity;
          }
        }
        var s = document.createElement("script");
        s.type = "text/javascript";
        s.src = "http://nominatim.openstreetmap.org/search/" + encodeURIComponent(address) + "?format=json&bounded=1&viewbox=" + LeafletLib.lngmin + "," + LeafletLib.latmax + "," + LeafletLib.lngmax + "," + LeafletLib.latmin +"&json_callback=LeafletLib.returnAddress";
        document.body.appendChild(s);
    },

    returnAddress: function(response){
        if(!response.length){
          alert("Sorry, no results found for that location.");
          return;
        }

        var first = response[0];
        var foundLocation = new L.LatLng(first.lat, first.lon);
        var icon = L.icon({iconUrl: '/images/blue-pushpin.png'})
        L.marker(foundLocation, {icon: icon}).addTo(LeafletLib.map)
        LeafletLib.map.setView( foundLocation, 15 );
    },

    geolocate: function(alt_callback){
        // Try W3C Geolocation
        var foundLocation;
        if(navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(position) {

              foundLocation = new L.LatLng(position.coords.latitude * 1.0, position.coords.longitude * 1.0);

              var icon = L.icon({iconUrl: '/images/blue-pushpin.png'})
              L.marker(foundLocation, {icon: icon}).addTo(LeafletLib.map)
              LeafletLib.map.setView( foundLocation, 15 );
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
