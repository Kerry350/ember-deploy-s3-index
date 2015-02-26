# Ember-deploy-s3-index

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

# `deploy.json`

```
{
  "development": {
    "store": {
      "type": "S3",
      "accessKeyId": "<key>",
      "secretAccessKey": "<key>",
      "bucket": "my-index-bucket"
    },

    "assets": {
      "type": "s3",
      "accessKeyId": "<key>",
      "secretAccessKey": "<key>",
      "bucket": "my-assets-bucket"
    }
  }
}
``` 

# Assumptions 

This adapter assumes you are using a dedicated index bucket. Amazon S3 doesn't charge for buckets themselves but for usage so this shouldn't create an issue. This allows us to easily list all revisions, and set a `manifestSize`. I may extend this in the future to allow a 'mixed content' bucket, but this would mean testing to ensure files are a valid index file before assuming they're part of the list, and this could get messy.

# TODOS

- Tests

# Guide 

For detailed instructions on how to use all of these addons to deploy an app to S3, with revisioning and previewing capabilities there's an article [here](http://kerrygallagher.co.uk/deploying-an-ember-cli-application-to-amazon-s3/).


