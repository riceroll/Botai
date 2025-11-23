var FOLDER_ID = '10T68Hhwr5KaLdvkD38zrVRjK9ik1KvWv';

function doPost(e) {
  try {
    var blob;
    
    // 兼容不同的上传方式
    if (e.postData && e.postData.contents) {
      // 从浏览器直接上传的情况
      blob = Utilities.newBlob(
        e.postData.contents,
        e.postData.type || 'application/octet-stream',
        'temp.obj'
      );
    } else if (e.postData) {
      // 尝试使用 getBlob
      blob = e.postData.getBlob();
    } else {
      throw new Error('No file data received');
    }

    // 处理文件名
    var nameBase = e.parameter.filename || ('model_' + new Date().getTime());
    var filename = nameBase;
    blob.setName(filename);

    // 保存到 Drive
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var file = folder.createFile(blob);

    var result = {
      success: true,
      filename: filename,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      createdAt: new Date().toISOString()
    };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: err.toString(),
        errorDetails: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 添加 CORS 支持
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}