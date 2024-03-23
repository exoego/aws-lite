import { join } from 'node:path'
import test from 'tape'
import mockTmp from 'mock-tmp'
import { defaults } from '../../../test/lib/index.mjs'
let { config } = defaults

let aws, client

let okJson = {
  statusCode: 200,
  headers: {
    'content-type': 'application/json',
  },
}

test('Set up env', async t => {
  t.plan(1)
  let cwd = process.cwd()
  let sut = 'file://' + join(cwd, 'src', 'index.js')
  client = (await import(sut)).default
  client.testing.enable({ usePluginResponseMethod: true })
  aws = await client({ ...config, plugins: [ import('@aws-lite/sqs') ] })
  t.ok(aws, 'Client ready')
})

test('SendMessageBatch', async t => {
  t.plan(2)

  let payload = {
    Failed: [],
    Successful: [
      {
        Id: 'test_msg_00',
        MessageId: 'c6e7fc6a-b802-4724-be06-59833004578b',
        MD5OfMessageBody: '7fb8146a82f95e0af155278f406862c2',
        MD5OfMessageAttributes: 'ba056227cfd9533dba1f72ad9816d233',
      }
    ],
  }
  client.testing.mock('SQS.SendMessageBatch', { ...okJson, payload })

  let sendMessageBatchResponse = await aws.SQS.SendMessageBatch({
    QueueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789000/MyQueue',
    Entries: [
      {
        Id: 'string',
        MessageBody: 'string',
        MessageAttributes: {
          'string': {
            DataType: 'string',
            BinaryListValues: [
              'blob'
            ],
            BinaryValue: 'blob',
            StringListValues: [
              'string'
            ],
            StringValue: 'string'
          }
        }
      },
    ],
  })
  t.equal(sendMessageBatchResponse.Failed.length, 0, 'Response has an empty Failed array')
  t.equal(sendMessageBatchResponse.Successful.length, 1, 'Response has a Successful array')
})

test('Tear down env', async t => {
  t.plan(1)
  client.testing.disable()
  mockTmp.reset()
  t.pass(`mockTmp removed`)
})
