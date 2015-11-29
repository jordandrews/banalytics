Summoners = new Mongo.Collection("summoners");
Champions = new Mongo.Collection("champions");
Matches = new Mongo.Collection("matches");
//var apiKey = '1d11392a-f109-4f57-90b3-731e31d79c6d';  // DEV
var apiKey = '2adbd56c-cc06-4c6b-9a28-35e79641f24a';
var matchNumToGet = 150;
var tenS = 10000;
//var rateLimitPer10s = 10;
var rateLimitPer10s = 3000;
var Future=Npm.require("fibers/future");
var rateLimit;

//TODO: MAKE RATE LIMITERS FOR EACH REGION + CALL REGION DATA FROM THAT ENDPIINT

Meteor.startup(function() {
  initialiseChamps();
  rateLimit = new RateLimit(rateLimitPer10s, tenS, true); //ENTER VARIABLES FOR TEST HERE
});

Meteor.publish("everyChamp", function () {
  return Champions.find();
});

Meteor.methods({
    getMultipleMatchDetails:function(matches, region){
        var range=_.range(matches.length);
        var matchList = [];
        var futures=_.map(range,function(index){
            var matchId = matches[index].matchId;
            var future=new Future();
            var matchQuery = Matches.find({
              matchId: matchId,
              region: region
            });
            if (matchQuery.count() < 1) {
              rateLimit.schedule(function(){
                HTTP.call("GET", 'https://' + region +'.api.pvp.net/api/lol/' + region + '/v2.2/match/' + matchId + '?api_key=' + apiKey,
                  function(error, result) {
                    var matchObject = JSON.parse(result.content);
                    matchObject["region"] = matchObject["region"].toLowerCase();
                    Matches.insert(matchObject);
                    future.return(matchObject);
                  });
              });
            } else {
              future.return(matchQuery.fetch()[0]);
            }
            return future;
        });
        var results=_.map(futures,function(future,index){
            var result=future.wait();
            return result;
        });
        return results;
    },getSummonerIdByName:function(summonerName, region) {
    var err;
    var future = new Future();
    var summonerQuery = Summoners.find({
      name: summonerName,
      region: region
    });

    if (summonerQuery.count() < 1) {
      rateLimit.schedule(function(){
        HTTP.call("GET", 'https://' + region + '.api.pvp.net/api/lol/' + region + '/v1.4/summoner/by-name/' + summonerName.toLowerCase().replace(" ", "") + '?api_key=' + apiKey,
          function(error, result) {
            if (error){
              err = error;
              future.return();
            }
            var summonerKey = summonerName.toLowerCase().replace(/ /g, "");
            var summonerObjects = JSON.parse(result.content);
            summonerObjects[summonerKey]["region"] = region;
            Summoners.insert(summonerObjects[summonerKey]);
            future.return(summonerObjects[summonerKey].id);
          });
      });
    } else {
      future.return(summonerQuery.fetch()[0].id);
    }

    var result = future.wait();
    if (err){
      throw new Meteor.Error(500, 'Couldn\'t retrieve data. Please check the summoner name is correct and they have played ranked games or try again later.');
    }

    return result;

  },getMatchListById:function(summonerId, region) {
    var future = new Future();
    rateLimit.schedule(function(){
      HTTP.call("GET", 'https://' + region +'.api.pvp.net/api/lol/' + region + '/v2.2/matchlist/by-summoner/' + summonerId + '?rankedQueues=RANKED_SOLO_5x5' + '&api_key=' + apiKey,
        function(error, result) {
          var allMatches = JSON.parse(result.content).matches;
          if (allMatches.length < matchNumToGet){
            matches = allMatches;
          } else {
            matches = allMatches.slice(0,matchNumToGet);
          }

          Meteor.call("getMultipleMatchDetails", matches, region, function(err, data){
            future.return(data);
          });
        });
    });
      return future.wait();
  }
});

function initialiseChamps() {
  console.log("initialise champs called");
  var imageString = "/champImages/";
  HTTP.call("GET", 'https://global.api.pvp.net/api/lol/static-data/oce/v1.2/champion?dataById=true&champData=image&api_key=1d11392a-f109-4f57-90b3-731e31d79c6d',
    function(error, result) {
      var allChamps = JSON.parse(result.content);
      for (var prop in allChamps.data) {
        if ((Champions.findOne({
            id: allChamps.data[prop].id
          }) == undefined)) {
          Champions.insert({
            id: allChamps.data[prop].id,
            title: allChamps.data[prop].title,
            name: allChamps.data[prop].name,
            imageUrl: imageString + allChamps.data[prop].image.full
          });
        }
      }
      var champs = Champions.find({}).fetch();
    });
}
