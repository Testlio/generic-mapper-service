* Create issue in Testlio:
   * priority mapped correctly (high - p1, medium - p2, low - p3)
   * title, description, tags
   * created under correct project
     * tag “testlio” attached
  * Update issue in client system
   * title, description sync to testlio
   * tags sync to testlio
   * add html description|title|comment in client system - should not break anything! 
   * state (mark as complete, add **fixed** tag)
      * mark as completed - close issue in Testlio
      * add **fixed** tag - **fixed** labels adds to testlio
* Update issue in Testlio
   * title, description sync to client system
   * tags sync to client system
   * add html description|title|comment in testlio - should not break anything! 
   * state
      * mark as approved - task appears to client system
      * mark as closed|duplicate - task completed in client system
      * reopen issue in testlio - task reappears to client system
      * add **fixed** label - adds **fixed** label to client system
* Modify data in Testlio and client system at the same time (same field) - should prioritise client system version of data (testlios change should be overwritten!)

* Create comment on issue in Testlio - should sync to client system
* Create comment on task in client system - should sync to testlio
* Add attachment to comment in testlio - attachment and comment sync to client system
* Add large-file (up to 10MB) attachment to testlio - should sync to client system
* Attachments sync from Testlio to client system



* Create issue in client system. Add testlio tag. -> Issue should be created to Testlio.
* Close issue in client system. Issue should get a close comment in Testlio.
* Change issue project in client system. Issue should still keep syncing!

* Create lot of issues to one project - should not break
