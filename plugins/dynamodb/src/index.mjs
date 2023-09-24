const service = 'dynamodb'
const required = true

// Common params to be AWS-flavored JSON-encoded
const awsjsonReq = [ 'ExclusiveStartKey', 'ExpressionAttributeValues', 'Item', 'Key', ]
// ... and decoded
const awsjsonRes = [ 'Item' ]

// Validation types
const arr = { type: 'array' }
const bool = { type: 'boolean' }
const obj = { type: 'object' }
const str = { type: 'string' }
const num = { type: 'number' }

// Common validation  params
const TableName = { ...str, required }
const Key = { ...obj, required }
const Item = { ...obj, required }
const ReturnConsumedCapacity = str
const ReturnItemCollectionMetrics = str


const unmarshall = keys => async response => ({ awsjson: keys, response })
const headers = (method, additional) => ({ 'X-Amz-Target': `DynamoDB_20120810.${method}`, ...additional })
const awsjsonContentType = { 'content-type': 'application/x-amz-json-1.0' }

/**
 * Plugin maintained by: @architect
 */

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchExecuteStatement.html
const BatchExecuteStatement = {
  validate: {
    Statements: { ...arr, required },
    ReturnConsumedCapacity,
  },
  request: async (params, { awsjsonMarshall }) => {
    // Huzzah, nested arrays with different kinds of serialization
    let Statements = params.Statements?.map(s => {
      let Parameters = s?.Parameters?.map(awsjsonMarshall)
      return {  ...s, Parameters }
    })
    return {
      awsjson: false, // Don't re-serialize to AWS-flavored JSON
      headers: headers('BatchExecuteStatement', awsjsonContentType), // Undocumented as of author time
      payload: { ...params, Statements }
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Responses?.length) {
      response.Responses = response.Responses.map(r => {
        if (r?.Error?.Item) r.Error.Item = awsjsonUnmarshall(r.Error.Item)
        if (r?.Item) r.Item = awsjsonUnmarshall(r.Item)
        return r
      })
    }
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
const BatchGetItem = {
  validate: {
    RequestItems: { ...obj, required },
    ReturnConsumedCapacity,
  },
  request: async (params, { awsjsonMarshall }) => {
    let RequestItems = {}
    Object.entries(params.RequestItems).forEach(([ table, item ]) => {
      RequestItems[table] = item
      RequestItems[table].Keys = item?.Keys?.map(awsjsonMarshall)
    })
    return {
      awsjson: false, // Don't re-serialize to AWS-flavored JSON
      headers: headers('BatchGetItem', awsjsonContentType),
      payload: { ...params, RequestItems }
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    let Responses = Object.keys(response.Responses)
    if (Responses.length) {
      Responses.forEach(i => response.Responses[i] = response.Responses[i]?.map(awsjsonUnmarshall))
    }
    let UnprocessedKeys = Object.keys(response.UnprocessedKeys)
    if (UnprocessedKeys.length) {
      UnprocessedKeys.forEach(i => response.UnprocessedKeys[i] = {
        ...response.UnprocessedKeys[i],
        Keys: response.UnprocessedKeys[i]?.Keys?.map(awsjsonUnmarshall)
      })
    }
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
const BatchWriteItem = {
  validate: {
    RequestItems: { ...obj, required },
    ReturnConsumedCapacity,
    ReturnItemCollectionMetrics,
  },
  request: async (params, { awsjsonMarshall }) => {
    let RequestItems = {}
    Object.entries(params.RequestItems).forEach(([ table, items ]) => {
      RequestItems[table] = items.map(i => {
        let request = {}
        Object.entries(i).forEach(([ op, data ]) => {
          if (op === 'DeleteRequest') {
            request[op] = { Key: awsjsonMarshall(data.Key) }
          }
          if (op === 'PutRequest') {
            request[op] = { Item: awsjsonMarshall(data.Item) }
          }
        })
        return request
      })
    })
    return {
      awsjson: false, // Don't re-serialize to AWS-flavored JSON
      headers: headers('BatchWriteItem', awsjsonContentType),
      payload: { ...params, RequestItems }
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    let UnprocessedItems = {}
    Object.entries(response.UnprocessedItems).forEach(([ table, items ]) => {
      UnprocessedItems[table] = items.map(i => {
        let request = {}
        Object.entries(i).forEach(([ op, data ]) => {
          if (op === 'DeleteRequest') {
            request[op] = { Key: awsjsonUnmarshall(data.Key) }
          }
          if (op === 'PutRequest') {
            request[op] = { Item: awsjsonUnmarshall(data.Item) }
          }
        })
        return request
      })
    })
    return { response: { ...response, UnprocessedItems } }
  }
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_CreateBackup.html
const CreateBackup = {
  validate: {
    TableName,
    BackupName: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('CreateBackup'), // Undocumented as of author time
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_CreateGlobalTable.html
const CreateGlobalTable = {
  validate: {
    GlobalTableName: TableName,
    ReplicationGroup: { ...arr, required },
  },
  request: async (params) => ({
    headers: headers('CreateGlobalTable'), // Undocumented as of author time
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_CreateTable.html
const CreateTable = {
  validate: {
    TableName,
    AttributeDefinitions: { ...arr, required },
    KeySchema: { ...arr, required },
    BillingMode: str,
    DeletionProtectionEnabled: bool,
    GlobalSecondaryIndexes: arr,
    LocalSecondaryIndexes: arr,
    ProvisionedThroughput: obj,
    SSESpecification: obj,
    StreamSpecification: obj,
    TableClass: str,
    Tags: arr,
  },
  request: async (params) => ({
    headers: headers('CreateTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteBackup.html
const DeleteBackup = {
  validate: {
    BackupArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DeleteBackup'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html
const DeleteItem = {
  validate: {
    TableName,
    Key,
    ConditionalOperator: str,
    ConditionExpression: str,
    Expected: obj, // Legacy, we're not automatically serializing to AWS-flavored JSON
    ExpressionAttributeNames: obj,
    ExpressionAttributeValues: obj,
    ReturnConsumedCapacity,
    ReturnItemCollectionMetrics,
    ReturnValues: str,
    ReturnValuesOnConditionCheckFailure: str,
  },
  request: async (params) => ({
    awsjson: awsjsonReq,
    headers: headers('DeleteItem'),
    payload: params,
  }),
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Attributes) response.Attributes = awsjsonUnmarshall(response.Attributes)
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteTable.html
const DeleteTable = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DeleteTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeBackup.html
const DescribeBackup = {
  validate: {
    BackupArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DescribeBackup'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeContinuousBackups.html
const DescribeContinuousBackups = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DescribeContinuousBackups'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeContributorInsights.html
const DescribeContributorInsights = {
  validate: {
    TableName,
    IndexName: str,
  },
  request: async (params) => ({
    headers: headers('DescribeContributorInsights'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeEndpoints.html
const DescribeEndpoints = {
  request: async () => ({
    headers: headers('DescribeEndpoints'),
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeExport.html
const DescribeExport = {
  validate: {
    ExportArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DescribeExport'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeGlobalTable.html
const DescribeGlobalTable = {
  validate: {
    GlobalTableName: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DescribeGlobalTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeGlobalTableSettings.html
const DescribeGlobalTableSettings = {
  validate: {
    GlobalTableName: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DescribeGlobalTableSettings'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeImport.html
const DescribeImport = {
  validate: {
    ImportArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DescribeImport'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeKinesisStreamingDestination.html
const DescribeKinesisStreamingDestination = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DescribeKinesisStreamingDestination'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeLimits.html
const DescribeLimits = {
  request: async () => ({
    headers: headers('DescribeLimits'),
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTable.html
const DescribeTable = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DescribeTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTableReplicaAutoScaling.html
const DescribeTableReplicaAutoScaling = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DescribeTableReplicaAutoScaling'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTimeToLive.html
const DescribeTimeToLive = {
  validate: {
    TableName,
  },
  request: async (params) => ({
    headers: headers('DescribeTimeToLive'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DisableKinesisStreamingDestination.html
const DisableKinesisStreamingDestination = {
  validate: {
    TableName,
    StreamArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('DisableKinesisStreamingDestination'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_EnableKinesisStreamingDestination.html
const EnableKinesisStreamingDestination = {
  validate: {
    TableName,
    StreamArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('EnableKinesisStreamingDestination'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ExecuteStatement.html
const ExecuteStatement = {
  validate: {
    TableName,
    Statement: { ...str, required },
    ConsistentRead: bool,
    Limit: num,
    NextToken: str,
    Parameters: obj,
    ReturnConsumedCapacity,
    ReturnValuesOnConditionCheckFailure: str,
  },
  request: async (params, { awsjsonMarshall }) => {
    if (params.Parameters) params.Parameters = params.Parameters.map(awsjsonMarshall)
    return {
      headers: headers('ExecuteStatement'),
      payload: params,
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Items?.length) {
      response.Items = response.Items.map(awsjsonUnmarshall)
    }
    return { awsjson: [ 'LastEvaluatedKey' ], response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ExecuteTransaction.html
const ExecuteTransaction = {
  validate: {
    TableName,
    TransactStatements: { ...arr, required },
    ClientRequestToken: str,
    ReturnConsumedCapacity,
  },
  request: async (params, { awsjsonMarshall }) => {
    if (params.TransactStatements){
      params.TransactStatements = params.TransactStatements.map(i => {
        if (i.Parameters) i.Parameters = i.Parameters.map(awsjsonMarshall)
        return i
      })
    }
    return {
      headers: headers('ExecuteTransaction'),
      payload: params,
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Responses?.length) {
      response.Responses = response.Responses.map(i => {
        i.Item = awsjsonUnmarshall(i.Item)
        return i
      })
    }
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ExportTableToPointInTime.html
const ExportTableToPointInTime = {
  validate: {
    S3Bucket: { ...str, required },
    TableArn: { ...str, required },
    ClientToken: str,
    ExportFormat: str,
    ExportTime: num,
    S3BucketOwner: str,
    S3Prefix: str,
    S3SseAlgorithm: str,
    S3SseKmsKeyId: str,
  },
  request: async (params) => ({
    headers: headers('ExportTableToPointInTime'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html
const GetItem = {
  validate: {
    TableName,
    Key,
    AttributesToGet: arr, // Legacy
    ConsistentRead: bool,
    ExpressionAttributeNames: obj,
    ProjectionExpression: str,
    ReturnConsumedCapacity,
  },
  request: async (params) => ({
    awsjson: awsjsonReq,
    headers: headers('GetItem'),
    payload: params,
  }),
  response: unmarshall(awsjsonRes),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ImportTable.html
const ImportTable = {
  validate: {
    InputFormat: { ...str, required },
    S3BucketSource: { ...obj, required },
    TableCreationParameters: { ...obj, required },
    ClientToken: str,
    InputCompressionType: str,
    InputFormatOptions: obj,
  },
  request: async (params) => ({
    headers: headers('ImportTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListBackups.html
const ListBackups = {
  validate: {
    BackupType: str,
    ExclusiveStartBackupArn: str,
    Limit: num,
    TableName: str,
    TimeRangeLowerBound: num,
    TimeRangeUpperBound: num,
  },
  request: async (params) => ({
    headers: headers('ListBackups'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListContributorInsights.html
const ListContributorInsights = {
  validate: {
    MaxResults: num,
    NextToken: str,
    TableName: str,
  },
  request: async (params) => ({
    headers: headers('ListContributorInsights'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListExports.html
const ListExports = {
  validate: {
    MaxResults: num,
    NextToken: str,
    TableArn: str,
  },
  request: async (params) => ({
    headers: headers('ListExports'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListGlobalTables.html
const ListGlobalTables = {
  validate: {
    ExclusiveStartGlobalTableName: str,
    Limit: num,
    RegionName: str,
  },
  request: async (params) => ({
    headers: headers('ListGlobalTables'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListImports.html
const ListImports = {
  validate: {
    NextToken: str,
    PageSize: num,
    TableArn: str,
  },
  request: async (params) => ({
    headers: headers('ListImports'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListTables.html
const ListTables = {
  validate: {
    ExclusiveStartTableName: str,
    Limit: num,
  },
  request: async (params) => ({
    headers: headers('ListTables'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ListTagsOfResource.html
const ListTagsOfResource = {
  validate: {
    NextToken: str,
    ResourceArn: { ...str, required },
  },
  request: async (params) => ({
    headers: headers('ListTagsOfResource'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html
const PutItem = {
  validate: {
    TableName,
    Item,
    ConditionalOperator: str, // Legacy
    ConditionExpression: str,
    Expected: str, // Legacy, we're not automatically serializing to AWS-flavored JSON
    ExpressionAttributeNames: obj,
    ExpressionAttributeValues: obj,
    ReturnConsumedCapacity,
    ReturnItemCollectionMetrics,
    ReturnValues: str,
    ReturnValuesOnConditionCheckFailure: str,
  },
  request: async (params) => ({
    awsjson: awsjsonReq,
    headers: headers('PutItem'),
    payload: params,
  }),
  response: unmarshall([ 'Attributes', ]),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
const Query = {
  validate: {
    TableName,
    AttributesToGet: arr,
    ConditionalOperator: str,
    ConsistentRead: bool,
    ExclusiveStartKey: obj,
    ExpressionAttributeNames: obj,
    ExpressionAttributeValues: obj,
    FilterExpression: str,
    IndexName: str,
    KeyConditionExpression: str,
    KeyConditions: obj, // Legacy, we're not automatically serializing to AWS-flavored JSON
    Limit: num,
    ProjectionExpression: str,
    QueryFilter: obj, // Legacy, we're not automatically serializing to AWS-flavored JSON
    ReturnConsumedCapacity: str,
    ScanIndexForward: bool,
    Select: str,
  },
  request: async (params) => ({
    awsjson: awsjsonReq,
    headers: headers('Query'),
    payload: params,
  }),
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Items?.length) response.Items = response.Items.map(awsjsonUnmarshall)
    if (response?.LastEvaluatedKey) {
      let key = response.LastEvaluatedKey[Object.keys(response.LastEvaluatedKey)[0]]
      response.LastEvaluatedKey = awsjsonUnmarshall(key)
    }
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_RestoreTableFromBackup.html
const RestoreTableFromBackup = {
  validate: {
    BackupArn: { ...str, required },
    TargetTableName: { ...str, required },
    BillingModeOverride: str,
    GlobalSecondaryIndexOverride: arr,
    LocalSecondaryIndexOverride: arr,
    ProvisionedThroughputOverride: obj,
    SSESpecificationOverride: obj,
  },
  request: async (params) => ({
    headers: headers('RestoreTableFromBackup'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_RestoreTableToPointInTime.html
const RestoreTableToPointInTime = {
  validate: {
    TargetTableName: { ...str, required },
    BillingModeOverride: str,
    GlobalSecondaryIndexOverride: arr,
    LocalSecondaryIndexOverride: arr,
    ProvisionedThroughputOverride: obj,
    RestoreDateTime: num,
    SourceTableArn: str,
    SourceTableName: str,
    SSESpecificationOverride: obj,
    UseLatestRestorableTime: bool,
  },
  request: async (params) => ({
    headers: headers('RestoreTableToPointInTime'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
const Scan = {
  validate: {
    TableName,
    AttributesToGet: arr,
    ConditionalOperator: str,
    ConsistentRead: bool,
    ExclusiveStartKey: obj,
    ExpressionAttributeNames: obj,
    ExpressionAttributeValues: obj,
    FilterExpression: str,
    IndexName: str,
    Limit: num,
    ProjectionExpression: str,
    ReturnConsumedCapacity: str,
    ScanFilter: obj,  // Legacy, we're not automatically serializing to AWS-flavored JSON
    Segment: num,
    Select: str,
    TotalSegments: num,
  },
  request: async (params) => ({
    headers: headers('Scan'),
    payload: params,
  }),
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Items?.length) response.Items = response.Items.map(awsjsonUnmarshall)
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TagResource.html
const TagResource = {
  validate: {
    ResourceArn: { ...str, required },
    Tags: { ...arr, required },
  },
  request: async (params) => ({
    headers: headers('TagResource'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactGetItems.html
const TransactGetItems = {
  validate: {
    TransactItems: arr,
    ReturnConsumedCapacity: str,
  },
  request: async (params, { awsjsonMarshall }) => {
    params.TransactItems = params.TransactItems.map(i => {
      // Required, but let Dynamo's validator blow up if not present
      if (i.Get.Key) i.Get.Key = awsjsonMarshall(i.Get.Key)
      return i
    })
    return {
      headers: headers('TransactGetItems'),
      payload: params,
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    if (response?.Responses?.length) response.Responses = response.Responses.map(i => {
      i.Item = awsjsonUnmarshall(i.Item)
      return i
    })
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html
const TransactWriteItems = {
  validate: {
    TransactItems: arr,
    ClientRequestToken: str,
    ReturnConsumedCapacity: str,
    ReturnItemCollectionMetrics: str,
  },
  request: async (params, { awsjsonMarshall }) => {
    params.TransactItems = params.TransactItems.map(i => {

      // One of the below four is required, but let Dynamo's validator blow up if not present
      /**/ if (i.ConditionCheck) {
        if (i.ConditionCheck.ExpressionAttributeValues) {
          i.ConditionCheck.ExpressionAttributeValues = awsjsonMarshall(i.ConditionCheck.ExpressionAttributeValues)
        }
        if (i.ConditionCheck.Key) {
          i.ConditionCheck.Key = awsjsonMarshall(i.ConditionCheck.Key)
        }
      }
      else if (i.Delete) {
        if (i.Delete.ExpressionAttributeValues) {
          i.Delete.ExpressionAttributeValues = awsjsonMarshall(i.Delete.ExpressionAttributeValues)
        }
        if (i.Delete.Key) {
          i.Delete.Key = awsjsonMarshall(i.Delete.Key)
        }
      }
      else if (i.Put) {
        if (i.Put.ExpressionAttributeValues) {
          i.Put.ExpressionAttributeValues = awsjsonMarshall(i.Put.ExpressionAttributeValues)
        }
        if (i.Put.Item) {
          i.Put.Item = awsjsonMarshall(i.Put.Item)
        }
      }
      else if (i.Update) {
        if (i.Update.ExpressionAttributeValues) {
          i.Update.ExpressionAttributeValues = awsjsonMarshall(i.Update.ExpressionAttributeValues)
        }
        if (i.Update.Key) {
          i.Update.Key = awsjsonMarshall(i.Update.Key)
        }
      }
      return i
    })
    return {
      headers: headers('TransactWriteItems'),
      payload: params,
    }
  },
  response: async (response, { awsjsonUnmarshall }) => {
    if (Object.keys(response?.ItemCollectionMetrics || {})?.length) {
      Object.entries(response?.ItemCollectionMetrics).forEach(([ table, items ]) => {
        response.ItemCollectionMetrics[table] = items.map(i => {
          i.ItemCollectionKey = awsjsonUnmarshall(i.ItemCollectionKey)
        })
      })
    }
    return { response }
  },
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UntagResource.html
const UntagResource = {
  validate: {
    ResourceArn: { ...str, required },
    TagKeys: { ...arr, required },
  },
  request: async (params) => ({
    headers: headers('UntagResource'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateContinuousBackups.html
const UpdateContinuousBackups = {
  validate: {
    TableName,
    PointInTimeRecoverySpecification: obj,
  },
  request: async (params) => ({
    headers: headers('UpdateContinuousBackups'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateContributorInsights.html
const UpdateContributorInsights = {
  validate: {
    TableName,
    ContributorInsightsAction: str,
    IndexName: str,
  },
  request: async (params) => ({
    headers: headers('UpdateContributorInsights'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateGlobalTable.html
const UpdateGlobalTable = {
  validate: {
    GlobalTableName: { ...str, required },
    ReplicaUpdates: arr,
  },
  request: async (params) => ({
    headers: headers('UpdateGlobalTable'),
    payload: params,
  }),
}

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateGlobalTableSettings.html
const UpdateGlobalTableSettings = {
  validate: {
    GlobalTableName: { ...str, required },
    GlobalTableBillingMode: str,
    GlobalTableGlobalSecondaryIndexSettingsUpdate: arr,
    GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate: obj,
    GlobalTableProvisionedWriteCapacityUnits: num,
    ReplicaSettingsUpdate: arr,
  },
  request: async (params) => ({
    headers: headers('UpdateGlobalTableSettings'),
    payload: params,
  }),
}

// TODO:
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html
// UpdateItem

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTable.html
// UpdateTable

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTableReplicaAutoScaling.html
// UpdateTableReplicaAutoScaling

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTimeToLive.html
// UpdateTimeToLive

const methods = { BatchExecuteStatement, BatchGetItem, BatchWriteItem, CreateBackup, CreateGlobalTable, CreateTable, DeleteBackup, DeleteItem, DeleteTable, DescribeBackup, DescribeContinuousBackups, DescribeContributorInsights, DescribeEndpoints, DescribeExport, DescribeGlobalTable, DescribeGlobalTableSettings, DescribeImport, DescribeKinesisStreamingDestination, DescribeLimits, DescribeTable, DescribeTableReplicaAutoScaling, DescribeTimeToLive, DisableKinesisStreamingDestination, EnableKinesisStreamingDestination, ExecuteStatement, ExecuteTransaction, ExportTableToPointInTime, GetItem, ImportTable, ListBackups, ListContributorInsights, ListExports, ListGlobalTables, ListImports, ListTables, ListTagsOfResource, PutItem, Query, RestoreTableFromBackup, RestoreTableToPointInTime, Scan, TagResource, TransactGetItems, TransactWriteItems, UntagResource, UpdateContinuousBackups, UpdateContributorInsights, UpdateGlobalTable, UpdateGlobalTableSettings }
export default { service, methods }
