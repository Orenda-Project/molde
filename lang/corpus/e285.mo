app "Job hunt" bag slate
table job company text, role text, status pick Applied|Interview|Offer|Rejected = Applied, followup date?
remind "Follow up on a job application today" at job.followup
count(job where status = Applied) "waiting," count(job where status = Interview) "interviews" head
each job where followup <= today and status = Applied sort followup as j
  row card tap edit j
    j.company j.role bold grow
    "Follow up" j.followup color warn
"All applications" head
list job
form job, "Add application"
