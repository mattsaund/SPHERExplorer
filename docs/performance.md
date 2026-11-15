# Performance

How fast the live site loads images, what limits it, and the measurements behind the server size in `docs/deploy.md`. The numbers were measured on Nov 14 and 15, 2026.

## What limits a first load

- The server reads only part of each 65 MB file from the bucket: about 1 MB per image for a 5 arcminute field, 2.5 MB for 15, and 5 MB for 30. S3 serves whole rows of an image, so a wider field costs more.
- Google caps every Cloud Run instance at 600 Mbps and 64,000 packets a second, both directions together (https://cloud.google.com/run/quotas). Measured on Nov 15, the server takes in 62 to 77 MB a second from the bucket, which is that cap.
- At the cap one load uses about one processor on the second generation runtime, and 1.3 to 1.8 on the first (see "Size"). More processors do not make a first load faster. That was measured with 2 and with 4.
- So a first load takes as long as its bytes take to arrive: the number of images, times the megabytes per image, at about 65 MB a second.
- The first image arrives in under half a second in every case, and the film can play while the rest come in.

## Measured on the live site

First loads of fields that nothing had cached, on Nov 15. Fields differ in how many images they have.

| Field | Images | First image | All images | Images a second |
|---|---|---|---|---|
| 5 arcmin | 297 | 0.45 s | 4.4 s | 68 |
| 15 arcmin | 301 | 0.12 s | 11.9 s | 25 |
| 30 arcmin | 254 | 0.42 s | 20.9 s | 12 |

- The same 30 arcminute field again, on the same instance: about 1 s. Finished frames stay in memory, already packed.
- Before the reading path was rewritten on Nov 14, the same kinds of load took 6.8 s, 19 s, and 34 s, and the repeat took 11 s.

## What the server does to get there

| Step | Before | After | What changed |
|---|---|---|---|
| First call on a cold instance | 15 s | under 0.01 s | The index ships in the image instead of being downloaded |
| Processor time per image, 5 arcmin | 24 ms | 5.1 ms | The bucket is read on worker threads over plain sockets, not with httpx. Each frame is packed once and kept packed. Photometry looks at a small box only |
| Processor time per image, 30 arcmin | 36 ms | 23 ms | The same, measured after httpx was already gone |
| Work on the event loop per image | most of it | 1.1 to 1.7 ms | Reading and math run on threads, on every processor |
| The same load again | 1.3 s | under 0.01 s | A finished frame is kept as the bytes that go to the browser |
| Page download, first visit | 1.01 MB | 0.78 MB | Files are compressed once at build time with Brotli, not on every request |
| Page download, later visits | 1.01 MB, revalidated | 0.004 MB | Files with a hash in their name are cached for good |

Processor times are from a development machine. The live instance takes three to five times as long for the same work.

- A file's layout is predicted from the first file of the same release and detector, and checked against the file's own table. That saves a read per image.
- A view of the sky map asks for its object list once, and the browser keeps the answer for an hour.
- After a deploy, open each of NASA's five test targets once. Their images then sit in the instance's memory for everyone who follows, as long as the instance lives.

## What the browser does

- Sums of images are three times faster than they were and are made in the background, so the page does not freeze on a wide field. The numbers are in `docs/methods.md`, section 6.
- A larger computer loads more images of a wide field. See `docs/methods.md`, section 18.

## What would make a first load faster still

- Keeping one instance running (`--min-instances 1`). Its memory then outlives quiet hours, so targets opened before stay instant. See "Cost".
- Spreading one load over several instances, each with its own network limit. Not built. It would need the browser to split a load and the frame memory to be shared.
- Reading less of each file is not possible without dropping the flags or part of the field.

## Server size comparison

The comparison, on the live site on Nov 15. First loads of the same three 5 arcminute fields, 457 to 487 images each, on an instance that had not seen them:

| Setup | When | All images | Together | Processor time |
|---|---|---|---|---|
| 4 processors, second generation | 8:56 am | 7.5 s, 6.5 s, 6.1 s | 20.1 s | not recorded |
| 2 processors, first generation | 10:52 am | 8.6 s, 7.6 s, 7.0 s | 23.2 s | 11.6 s, 10.3 s, 9.0 s |
| 4 processors, first generation | 11:00 am | 7.0 s, 9.7 s, 7.2 s | 23.9 s | 12.3 s, 16.8 s, 11.9 s |
| 4 processors, second generation | 11:06 am | 8.4 s, 7.2 s, 5.5 s | 21.1 s | 6.2 s, 5.9 s, 5.2 s |

- One run each. The same field varies by a second or so from run to run, so the totals and the processor time tell the setups apart, not any single load.
- The first generation runs the server in a sandbox that handles its network calls, and that costs processor time. More processors did not make it faster.
- Not measured: 2 processors on the second generation. One load uses about one processor there, so it may be as fast for a single visitor, at a little over half the cost per busy second.

History: 2 processors, 2 GB, and 4 instances until Nov 14. Then 4 processors, 4 GB, 2 instances, and the second generation. For an hour on Nov 15 the first generation ran, with 2 and then 4 processors, for the comparison above.
