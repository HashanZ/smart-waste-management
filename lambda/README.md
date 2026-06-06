# Lambda Function: Process Bin Data

This Lambda function receives HTTP POST requests from AWS API Gateway, validates the data, and updates MongoDB.

## Runtime Compatibility

- **Node.js 22.x**: ✅ Recommended (latest, supported until April 2027)
- **Node.js 20.x**: ✅ Supported (supported until April 2026)
- **Node.js 18.x**: ✅ Supported (LTS)
- **Node.js 24.x**: ❌ Not yet available in AWS Lambda

## Setup

### Option 1: Upload ZIP to Lambda (Recommended)

1. Install dependencies:
```bash
npm install
```

2. Create deployment package:
```bash
zip -r lambda.zip . -x "*.git*" "*.md" "node_modules/.cache/*"
```

3. Upload to Lambda:
   - Lambda Console → Your function → Code
   - Upload from → .zip file
   - Select `lambda.zip`

### Option 2: Use Lambda Layers

1. Create a layer with `mongodb` package
2. Attach layer to Lambda function

## Environment Variables

Set these in Lambda → Configuration → Environment variables:

- `MONGODB_URI`: Your MongoDB connection string
- `DB_NAME`: Database name (default: 'smartwaste')

## Testing

### Test Event (Lambda Console)

```json
{
  "body": "{\"binId\":\"BIN001\",\"fillLevel\":71.24,\"batteryLevel\":100,\"signalStrength\":58}"
}
```

### Test from Command Line

```bash
aws lambda invoke \
  --function-name smartwaste-process-bin-data \
  --payload '{"body":"{\"binId\":\"BIN001\",\"fillLevel\":71.24}"}' \
  response.json
```

## Deployment

After updating code:
1. Save changes in Lambda console, OR
2. Upload new ZIP file

## Monitoring

- **CloudWatch Logs**: `/aws/lambda/smartwaste-process-bin-data`
- **Metrics**: Lambda → Monitor tab

## Troubleshooting

- **Timeout**: Increase timeout to 30 seconds
- **MongoDB Error**: Check connection string and network access
- **Memory**: Increase to 256MB if needed

