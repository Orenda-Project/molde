app "Job hunt" bag ocean
table job company text, applied date = today, status pick Applied|Interview|Offer|Rejected = Applied, follow date
remind "Follow up on a job application" at job.follow
count(job where status = Applied) "waiting," count(job where status = Interview) "interviews" head
each job sort follow as j
  row card gap 1 tap edit j swipe remove j
    stack grow
      j.company bold
      "applied" j.applied "follow up" j.follow faint
    j.status color if(j.status = Offer, good, if(j.status = Rejected, bad, ink))
form job
