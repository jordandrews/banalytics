Champions = new Mongo.Collection("champions");

Meteor.subscribe("everyChamp");
initialiseClientInterface();
Template.body.events({
  'submit .summoner-search': function() {
    //$("#ban-list").hide();
    $("#loading-spinner-container").show();
    event.preventDefault();
     var summonerName = event.target.summonerName.value;
     var region = event.target.region.value;
     //WILL NEED TO CHECK THAT NAME EXISTS?
     Meteor.call("getSummonerIdByName", summonerName, region, function(error, result){
       if (error){

       }
       Session.set('summonerName', summonerName);
       Session.set('summonerId', result);
       Meteor.call("getMatchListById", Session.get('summonerId'), region, function(error, result){
         getRecommendedBans(result, Session.get('summonerId'));
       });
     });
  }
});

Template.body.helpers({
  champsToBan: function() {
    return Session.get('champsToBan');
  },
  champsToKeep: function() {
    return Session.get('champsToKeep');
  },
  allChamps1: function() {
    return Session.get('allChamps1');
  },
  allChamps2: function() {
    return Session.get('allChamps2');
  },
  allChamps3: function() {
    return Session.get('allChamps3');
  },
  allChamps4: function() {
    return Session.get('allChamps4');
  },
  summonerName: function() {
    return Session.get('summonerName');
  },
  gameNum: function(){
    return Session.get('gameNum');
  }
});

function showUserError(){

}

function initialiseClientInterface() {
  $(document).ready(function() {
    $('select').material_select();
  });
}

function getRecommendedBans(completeMatchList, summonerId) {
  var championVsWins = [];
  var championVsLosses = [];
  //for all games - get whether win or loss.
  //get other team - assign win or loss to all 5 champs
  for (var i = 0; i < completeMatchList.length; i++) {
    var participantId = getParticipantIdFromSummonerId(completeMatchList[i], summonerId);
    var participant = completeMatchList[i].participants[participantId - 1];
    var participantTeamId = participant.teamId;
    var gameWin;
    var loopStart;
    var loopEnd;
    if (participantTeamId == 100) {
      gameWin = completeMatchList[i].teams[0].winner;
      loopStart = 5;
      loopEnd = 10;
    } else if (participantTeamId == 200) {
      gameWin = completeMatchList[i].teams[1].winner;
      loopStart = 0;
      loopEnd = 5;
    }
    for (var j = loopStart; j < loopEnd; j++) {
      var champId = completeMatchList[i].participants[j].championId;
      if (gameWin) {
        if (championVsWins[champId] == undefined) {
          championVsWins[champId] = 1;
        } else {
          championVsWins[champId] = championVsWins[champId] + 1;
        }
      } else {
        if (championVsLosses[champId] == undefined) {
          championVsLosses[champId] = 1;
        } else {
          championVsLosses[champId] = championVsLosses[champId] + 1;
        }
      }
    }
  }
  var allChampsToDisplay = [];
  var allChampCursor =
  Champions.find({}, {sort: {name: 1}}).forEach(function(doc) {
    var wins;
    var losses;
    var percentage;
    var winSortScore;
    var lossSortScore;
    if (championVsWins[doc.id] == undefined) {
      wins = 0;
    } else {
      wins = championVsWins[doc.id];
    }
    if (championVsLosses[doc.id] == undefined) {
      losses = 0;
    } else {
      losses = championVsLosses[doc.id];
    }
    if (wins + losses > 0) {
      percentage = (wins / (wins + losses))*100;
      winSortScore = (wins - losses) * percentage;
      lossSortScore = (losses-wins) * (100-percentage);
      percentage = Math.round(percentage * 100) / 100 + "%";
    } else {
      percentage = "";
      winSortScore = 0;
      lossSortScore = 0;
    }
    allChampsToDisplay.push({
      name: doc.name,
      wins: wins,
      losses: losses,
      percentage: percentage,
      imageUrl: doc.imageUrl,
      winSortScore: winSortScore,
      lossSortScore: lossSortScore
    });
    // Put in some data about player, scroll to position, get rid of icon in contact field,
    //have option to show win rates vs all champions.
  });
  Session.set('gameNum', completeMatchList.length);
  Session.set('allChamps1', allChampsToDisplay.slice(0,32));
  Session.set('allChamps2', allChampsToDisplay.slice(32,64));
  Session.set('allChamps3', allChampsToDisplay.slice(64,96));
  Session.set('allChamps4', allChampsToDisplay.slice(96));
  allChampsToDisplay.sort(compareLossRatio);
  Session.set('champsToBan', allChampsToDisplay.slice(0, 6));
  allChampsToDisplay.sort(compareWinRatio);
  Session.set('champsToKeep', allChampsToDisplay.slice(0,6));
  $("#ban-list").show();
  $("#loading-spinner-container").hide();
    $('html, body').animate({
        scrollTop: $("#ban-list").offset().top
    }, 1000);

  $(".tooltipped").delay(500).tooltip({delay:25});
}

function compareWinRatio(a,b) {
  if (a.winSortScore > b.winSortScore)
    return -1;
  if (a.winSortScore < b.winSortScore)
    return 1;
  return 0;
}

function compareLossRatio(a,b) {
  if (a.lossSortScore > b.lossSortScore)
    return -1;
  if (a.lossSortScore < b.lossSortScore)
    return 1;
  return 0;
}

function getParticipantIdFromSummonerId(matchObject, summonerId) {
  for (var i = 0; i < matchObject.participantIdentities.length; i++) {
    if (matchObject.participantIdentities[i].player.summonerId == summonerId) {
      return matchObject.participantIdentities[i].participantId;
    }
  }
}
