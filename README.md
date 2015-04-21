# Ember-deploy-s3-index ![Travis CI](https://travis-ci.org/Kerry350/ember-deploy-s3-index.svg?branch=master)

This is the S3-adapter implementation to use [Amazon S3](http://aws.amazon.com/s3) with
[ember-deploy](https://github.com/levelbossmike/ember-deploy), for index page management rather than asset management. For S3 managed assets the default adapter already exists [here](https://github.com/LevelbossMike/ember-deploy-s3).

# Modes

The idea with this adapter is you may want to serve your `index.html` file directly from a bucket, or you may have a backend server setup. Technically the default assets adapter does upload your `index.html` file, but this adapter works on the premise of having a bucket(s) dedicated to your index files, so that you can take advantage of the revisioning and previewing capabilities.

The adapter leaves two methods of handling the index files open to you (implementation comes down to you). With `direct` serving the idea is you have set your index bucket up as a 'static site' and when people navigate to your website they're hitting the bucket directly, and thus get served the `index.html` file contained within it. This is great if your Ember app relies on 3rd Party APIs, CORS or maybe doesn't communicate with an API at all (games etc). You still have revisioning capabilities here for rollbacks etc, and previewing capabilities by using one extra bucket.

Amazon have documentation on setting up your bucket in this way [here](http://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html)

`proxy` serving assumes you have a backend server setup of some kind, and are using S3 as a storage mechanism rather than the host itself. Using this mode you would query your S3 bucket directly, and serve the results, just like lookups with the default Redis adapter. On application boot you could query for the `current` implementation which would be that represented by `index.html`, store this in memory, and serve on consequent requests. If a revision was requested via a query parameter you can query the bucket for the revision `<app-name>:<sha>.html` and serve what's returned.

The add-on uses one set of logic, but allows you the freedom to use those files in two ways.

# File representation

- `index.html` will always represent your activated revision, or `current`.
- Versions look like this: `<revisionTag>.html`, for example `ember-deploy:44f2f92.html` if using the default SHA tagging adapter and with a project name of 'Ember Deploy'.

# `deploy.js`

```
module.exports = {
  development: {
    store: {
      type: "S3",
      accessKeyId: "ID",
      secretAccessKey: "KEY",
      bucket: "BUCKET",
      acl: 'public-read', //optional, e.g. 'public-read', if ACL is not configured, it is not sent
      hostName: "my-index-bucket.s3-my-region.amazonaws.com", // To be set with 'direct' indexMode
      indexMode: "indirect", // Optional: 'direct' or 'indirect', 'direct' is used by default.
      prefix: "app-one/" // Optional: Allows a folder setup within the bucket, so that multiple apps can be stored in one bucket (or maybe things like A/B testing grouped together). Use with 'indirect' indexMode only.
    },

    assets: {
      type: "s3",
      accessKeyId: "ID",
      secretAccessKey: "KEY",
      bucket: "BUCKET"
    }
  }
}
```

# `acl`

This configuration option allows you to specify a permissions used for uploaded files to S3, in the form of a ["canned ACL"](http://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl).

As an *alternative* to using this `acl` option, you can configure a policy on the bucket:

In the S3 section of the AWS console, Right click your bucket -> properties -> permissions -> Add bucket policy. Paste the following in:

```
{
    "Statement": [
        {
            "Sid": "AllowPublicRead",
            "Effect": "Allow",
            "Principal": {
                "AWS": "*"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<BUCKET NAME>/*"
        }
    ]
}
```


# `indexMode`

Direct assumes you're serving your app directly from the bucket, using the static site hosting mode. It uses `putBucketWebsite` to update the Index Document equal to the revision. Indirect doesn't make any strict assumptions, but you'd probably be using the bucket as a storage mechanism only. With indirect an `index.html` file is updated to match the contents of a revision, so at any point there's a concept of 'current' for a server to query against.

# Assumptions

This adapter assumes you are using a dedicated index bucket. Amazon S3 doesn't charge for buckets themselves but for usage so this shouldn't create an issue. This allows us to easily list all revisions, and set a `manifestSize`. I may extend this in the future to allow a 'mixed content' bucket, but this would mean testing to ensure files are a valid index file before assuming they're part of the list, and this could get messy.

# TODOS

- Improve tests

# Guide

For detailed instructions on how to use all of these addons to deploy an app to S3, with revisioning and previewing capabilities there's an article [here](http://kerrygallagher.co.uk/deploying-an-ember-cli-application-to-amazon-s3/).

# Using History-Location
You can deploy your Ember application to S3 and still use the history-api for pretty URLs. This needs some configuration tweaking in your bucket's static-website-hosting options in the AWS console though. You can use S3's `Redirection Rules`-feature to redirect user's to the correct route based on the URL they are requesting from your app:

```
<RoutingRules>
    <RoutingRule>
        <Condition>
            <HttpErrorCodeReturnedEquals>404</HttpErrorCodeReturnedEquals>
        </Condition>
        <Redirect>
            <HostName><your-bucket-endpoint-from-static-website-hosting-options></HostName>
            <ReplaceKeyPrefixWith>#/</ReplaceKeyPrefixWith>
        </Redirect>
    </RoutingRule>
</RoutingRules>
```
