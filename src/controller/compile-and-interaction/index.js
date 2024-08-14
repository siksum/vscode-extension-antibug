const vscode = acquireVsCodeApi();
let selectedContract = {};
let selectedAccount = {};
$(window).ready(() => {
  vscode.postMessage({
    type: "init",
  });
});

$(".compile__files select").change((event) => {
  const path = event.target.value;

  vscode.postMessage({
    type: "openFile",
    payload: {
      path,
    },
  });
});

$(".compile__run").click(() => {
  $(".compile__run").addClass("loading");
  const path = $(".compile__files select").val();

  vscode.postMessage({
    type: "compile",
    payload: {
      path,
    },
  });
});

$(".interaction__from-list select").change((event) => {
  const privateKey = event.target.value;
  const optionElement = $(event.target).find(`option[value="${privateKey}"]`);
  const address = optionElement.text().split("(")[0];
  const balance = optionElement.text().split("(")[1].split(")")[0];

  selectedAccount = {
    address,
    privateKey,
    balance,
  };
  vscode.postMessage({
    type: "changeAccount",
    payload: {
      account: {
        address,
        privateKey,
        balance,
      },
    },
  });
});

$(".interaction__value-amount").change(() => {
  const amount = $(".interaction__value-amount input").val();
  const type = $(".interaction__value-amount select").val();

  const regex = /^[0-9]*$/;
  if (!regex.test(amount)) {
    $(".interaction__value-amount input").val("0");
    return;
  }
  if (Number(amount) > Number(selectedAccount.balance)) {
    return;
  }

  vscode.postMessage({
    type: "changeValue",
    payload: {
      value: {
        amount,
        type,
      },
    },
  });
});

$(".interaction__from .copy").click(() => {
  navigator.clipboard.writeText(selectedAccount.address);
});

$(".deploy__run-show-arguments").click(() => {
  $(".deploy__arguments").toggleClass("hidden");

  $(".deploy__run-show-arguments").toggleClass("rotate");

  const deployArgumentsElement = $(".deploy__arguments");
  if (!deployArgumentsElement.hasClass("hidden")) {
    $("html, body").animate(
      { scrollTop: $(document).height() },
      "fast",
      "swing"
    );
  }
});

$(".deploy__contracts select").change((event) => {
  const contract = JSON.parse(event.target.value);

  selectedContract = contract;

  changeDeployButtonColor(contract);
  generateContractArguments(contract);
});

$(".deploy__info-abi").click(() => {
  if (!selectedContract) return;
  navigator.clipboard.writeText(JSON.stringify(selectedContract.abis));
});

$(".deploy__info-bytecodes").click(() => {
  if (!selectedContract) return;
  navigator.clipboard.writeText(selectedContract.bytecodes);
});

$(".deploy__run-deploy").click(() => {
  const deployArgumentsElement = $(".deploy__arguments");
  const deployArguments = [];

  deployArgumentsElement
    .find(".deploy__argument input")
    .each((index, input) => {
      deployArguments.push(input.value);
    });

  vscode.postMessage({
    type: "deploy",
    payload: {
      args: deployArguments,
      contract: selectedContract,
    },
  });
});

window.addEventListener("message", ({ data: { type, payload } }) => {
  switch (type) {
    case "init": {
      const { accounts, solFiles } = payload;

      solFiles.forEach(({ path }) => {
        const optionElement = $("<option></option>");
        optionElement.val(path);
        optionElement.text(path.split("/").pop());
        $(".compile__files select").append(optionElement);
      });

      selectedAccount = {
        address: accounts[0].address,
        privateKey: accounts[0].privateKey,
        balance: accounts[0].balance,
      };
      changeAccountState(accounts, selectedAccount);

      break;
    }
    case "changeAccountState": {
      const { accounts } = payload;

      changeAccountState(accounts, selectedAccount);

      break;
    }
    case "compileResult": {
      const { contracts } = payload;
      if (contracts) {
        const contractNames = Object.keys(contracts);
        const contractsSelectElement = $(".deploy__contracts select");
        contractsSelectElement.empty();

        contractNames.forEach((contractName) => {
          const optionElement = $("<option></option>");
          optionElement.val(
            JSON.stringify({
              name: contractName,
              ...contracts[contractName],
            })
          );
          optionElement.text(contractName);

          contractsSelectElement.append(optionElement);
        });

        selectedContract = {
          name: contractNames[0],
          ...contracts[contractNames[0]],
        };

        changeDeployButtonColor(selectedContract);
        generateContractArguments(selectedContract);
      }

      $(".compile__run").removeClass("loading");
      break;
    }

    case "changeValue": {
      const { value } = payload;

      $(".interaction__value-amount input").val(value);
      break;
    }
  }
});

const changeDeployButtonColor = (contract) => {
  const { abis } = contract;
  const constructorInputs = abis[0];

  if (
    constructorInputs.type === "constructor" &&
    constructorInputs.stateMutability === "payable"
  ) {
    $(".deploy__run-deploy").css({
      background: "var(--button-background-tertiary)",
    });
  } else {
    $(".deploy__run-deploy").css({
      background: "var(--button-background-primary)",
    });
  }
};

const generateContractArguments = (contract) => {
  const { abis } = contract;
  const constructorInputs = abis[0];

  const deployArgumentsDivElement = $(".deploy__arguments");
  deployArgumentsDivElement.empty();

  if (
    constructorInputs.type === "constructor" &&
    constructorInputs.inputs.length > 0
  ) {
    $(".deploy__run-show-arguments").attr("disabled", false);
    $(".deploy__run-show-arguments svg")
      .removeClass("fa-minus")
      .addClass("fa-chevron-down");
    constructorInputs.inputs.forEach((input) => {
      const { name, type } = input;

      deployArgumentsDivElement.append(`
                <div class="deploy__argument">
                  <div class="deploy__argument-info">
                    <div class="type">${type}</div> <div class="name">${name}</div>
                  </div>
                  <input  type="text" />
                </div>
              `);
    });
  } else {
    $(".deploy__run-show-arguments").attr("disabled", true);
    $(".deploy__run-show-arguments svg")
      .removeClass("fa-chevron-down")
      .addClass("fa-minus");
  }
};

const changeAccountState = (accounts, currentAccount) => {
  const fromSelectElement = $(".interaction__from-list select");

  fromSelectElement.empty();
  accounts.forEach(({ address, balance, privateKey }) => {
    const optionElement = $("<option></option>");
    optionElement.val(privateKey);
    optionElement.text(`${address}(${balance})`);

    fromSelectElement.append(optionElement);
  });

  fromSelectElement.val(currentAccount.privateKey);
};
