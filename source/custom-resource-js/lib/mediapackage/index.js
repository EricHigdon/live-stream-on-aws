/**
 * @author Solution Builders
 * @function MediaPackage
 * @description AWS Elemental MediaPackage module for Node 8.10+
*/

const AWS = require('aws-sdk');
const url = require('url');

// FEATURE/P15424610:: Function updated to use Async
let CreateEndPoint = async (config) => {
  const mediapackage = new AWS.MediaPackage();
  let responseData;
  try {
    //Define specific configuration settings for each endpoint type (HLS/DASH/MSS)
    let packages = {
      HlsPackage: {
        IncludeIframeOnlyStream: false,
        PlaylistType: 'NONE',
        PlaylistWindowSeconds: 60,
        ProgramDateTimeIntervalSeconds: 0,
        SegmentDurationSeconds: 6,
        UseAudioRenditionGroup: false
      },
      DashPackage: {
        ManifestWindowSeconds: 60,
        MinBufferTimeSeconds: 30,
        MinUpdatePeriodSeconds: 15,
        Profile: 'NONE',
        SegmentDurationSeconds: 2,
        SuggestedPresentationDelaySeconds: 25
      },
      MssPackage: {
        ManifestWindowSeconds: 60,
        SegmentDurationSeconds: 2
      }
    };
    let params = {
      ChannelId: config.ChannelId,
      Description: 'Live Streaming on AWS Solution',
      ManifestName: 'index',
      StartoverWindowSeconds: 0,
      TimeDelaySeconds: 0,
    };
    //Add configuration based on the endpoint type defined in config
    switch (config.EndPoint) {
      case 'HLS':
        params.Id = config.ChannelId + '-hls';
        params.HlsPackage = packages.HlsPackage;
        break;
      case 'DASH':
        params.Id = config.ChannelId + '-dash';
        params.DashPackage = packages.DashPackage;
        break;
      case 'MSS':
        params.Id = config.ChannelId + '-mss';
        params.MssPackage = packages.MssPackage;
        break;
      default:
        console.log('Error EndPoint not defined');
    }
    // Create Endpoint & return detials
    let data = await mediapackage.createOriginEndpoint(params).promise();

    let Url = url.parse(data.Url);
    responseData = {
      Id: data.Id,
      DomainName: Url.hostname,
      Path: '/' + Url.pathname.split('/')[3],
      Manifest: Url.pathname.slice(7)
    };
  }
  catch (err) {
    throw err;
  }
  return responseData;
};


// FEATURE/P15424610:: Function updated to use Async
let CreateChannel = async (config) => {
  const mediapackage = new AWS.MediaPackage({
    region: process.env.AWS_REGION
  });
  const ssm = new AWS.SSM({
    region: process.env.AWS_REGION
  });
  let responseData;

  try {

    let params = {
      Id: config.ChannelId,
      Description: 'Live Streaming on AWS Solution'
    };
    let data = await mediapackage.createChannel(params).promise();

    responseData = {
      ChannelId: config.ChannelId,
      PrimaryUrl: data.HlsIngest.IngestEndpoints[0].Url,
      PrimaryUser: data.HlsIngest.IngestEndpoints[0].Username,
      PrimaryPassParam: data.HlsIngest.IngestEndpoints[0].Username,
      // FEATURE/P15424610:: Dual ingest support added to MediaPackage, returning
      // details for both Ingest Endpoints. Update due for GA 08/28
      SecondaryUrl: data.HlsIngest.IngestEndpoints[1].Url,
      SecondaryUser: data.HlsIngest.IngestEndpoints[1].Username,
      SecondaryPassParam: data.HlsIngest.IngestEndpoints[1].Username
    };

    // Adding User/Passord to SSM parameter store.
    let primary = {
      Name: data.HlsIngest.IngestEndpoints[0].Username,
      Type: 'String',
      Value: data.HlsIngest.IngestEndpoints[0].Password,
      Description:'live-streaming-on-aws MediaPackage Primary Ingest Username'
    };
    await ssm.putParameter(primary).promise();

    let secondary = {
      Name: data.HlsIngest.IngestEndpoints[1].Username,
      Type: 'String',
      Value: data.HlsIngest.IngestEndpoints[1].Password,
      Description:'live-streaming-on-aws MediaPackage Secondary Ingest Username'
    };
    await ssm.putParameter(secondary).promise();
  }
  catch (err) {
    throw err;
  }
  return responseData;
};


// FEATURE/P15424610:: Function updated to use Async
let DeleteChannel = async (ChannelId) => {
  const mediapackage = new AWS.MediaPackage({
    region: process.env.AWS_REGION
  });
  try {
    let params = {
      ChannelId: ChannelId
    };
    //Get a list of the endpoints Ids
    let data = await mediapackage.listOriginEndpoints(params).promise();
    //Delete the list of endpoints and wait for the deletes to complete.
    let endPoints = data.OriginEndpoints;
    await Promise.all(endPoints.map(async (endpoint) => {
      params = {
        Id: endpoint.Id
      };
      await mediapackage.deleteOriginEndpoint(params).promise();
    }));
    //Delete the Channel.
    params = {
      Id: ChannelId
    };
    await mediapackage.deleteChannel(params).promise();
  }
  catch (err) {
    throw err;
  }
  return;
};


module.exports = {
  createEndPoint: CreateEndPoint,
  createChannel: CreateChannel,
  deleteChannel: DeleteChannel
};
