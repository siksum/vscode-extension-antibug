(function () {
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  $(window).ready(() => {
    vscode.postMessage({
      type: "init",
      payload: {
        // rules: oldState.rules,
        // files: oldState.files,
      },
    });
  });

  $(".analysis__run").click(() => {
    // $(".analysis__run").addClass("loading");
    const selectedSolFile = $(".analysis__files select").val();
    const selectedRules = [];
    $(".rule__list input[name=checkbox]:checked").each(function () {
      const value = $(this).siblings(".rule__text").text();
      selectedRules.push(value);
    });

    if (selectedRules.length === 0) {
      vscode.postMessage({
        type: "error",
        payload: {
          errMsg: "Please select one or more rules.",
        },
      });
    } else {
      const rulesString = selectedRules.join(" ");

      // vscode.setState({ rules: rulesString, files: selectedSolFile });

      vscode.postMessage({
        type: "RunAnalysis",
        payload: {
          rules: rulesString,
          files: selectedSolFile,
        },
      });
    }
  });

  $(".analysis__files select").change((event) => {
    const path = event.target.value;

    // vscode.setState({
    //   file: path,
    // });

    vscode.postMessage({
      type: "changeFile",
      payload: {
        path,
      },
    });
  });

  // $(".auditReport__extract").click(() => {
  //   vscode.postMessage({
  //     type: "ExtractAuditReport",
  //     payload: {},
  //   });
  // });

  window.addEventListener("message", ({ data: { type, payload } }) => {
    switch (type) {
      case "init": {
        const { solFiles } = payload;

        solFiles.forEach(({ path }) => {
          const optionElement = $("<option></option>");
          optionElement.val(path);
          optionElement.text(path.split("/").pop());

          $(".analysis__files select").append(optionElement);
        });

        break;
      }

      case "analysisResult": {
        const AuditReportElement = $(".auditReport__extract");

        const auditReportButtonExists =
          AuditReportElement.find(".auditReport").length > 0;

        if (!auditReportButtonExists) {
          AuditReportElement.append(
            `<button class="auditReport">Extract Audit Report</button>`
          );
        }
      }
    }
  });
})();
