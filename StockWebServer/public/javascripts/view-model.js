/***********************************************************************************
 * ViewModel class.
 * @constructor
 */
function ViewModel() {
    var self = this;

    // object model
    this.companies = [];
    this.updating = ko.observable(0);
    this.minDate = ko.observable(null);
    this.chartSeries = ko.observable([]);
    this.chartStyles = ko.observable([]);
    this.chartHoverStyles = ko.observable([]);
    this.chartVisible = ko.observable(false);
    this.period=30;
    this.setMinDate(this.period); // chart 30 minutes of data by default
    this.minDate.subscribe(function () { self.updateChartData() });
    this.portfolio = new Portfolio(this);

    // create color palette
    this.palette = [
        "#FFBE00", "#C8C800", "#94D752", "#00B652", "#00B6EF", "#0075C6", "#002263", "#73359C", // Standard
        "#B53D9C", "#F7E7EF", "#BD3D6B", "#AD65BD", "#DE6D33", "#FFB638", "#CE6DA5", "#FF8E38", // Opulent
        "#525D6B", "#FFF39C", "#FF8633", "#739ADE", "#B52B15", "#F7CF2B", "#ADBAD6", "#737D84", // Oriel
        "#424452", "#DEEBEF", "#737DA5", "#9CBACE", "#D6DB7B", "#FFDB7B", "#BD8673", "#8C726B", // Origin
        "#424C22", "#FFFBCE", "#A5B694", "#F7A642", "#E7BE2B", "#D692A5", "#9C86C6", "#849EC6", // Paper
        "#4A2215", "#E7DFCE", "#3892A5", "#FFBA00", "#C62B2B", "#84AA33", "#944200", "#42598C", // Solstice
        "#383838", "#D6D3D6", "#6BA2B5", "#CEAE00", "#8C8AA5", "#738663", "#9C9273", "#7B868C", // Technic
        "#15487B", "#EFEFE7", "#4A82BD", "#C6504A", "#9CBA5A", "#8465A5", "#4AAEC6", "#F79642", // Office
        "#6B656B", "#CEC3D6", "#CEBA63", "#9CB284", "#6BB2CE", "#6386CE", "#7B69CE", "#A578BD", // Apex
        "#332E33", "#E7DFD6", "#F77D00", "#382733", "#15597B", "#4A8642", "#63487B", "#C69A5A", // Aspect
        "#636984", "#C6D3D6", "#D6604A", "#CEB600", "#28AEAD", "#8C7873", "#8CB28C", "#0E924A" // Civic
    ];

    // populate companies array
    $.get("/companyList", function (result) {
        if(typeof result=='string'){
            try{
                result= eval(result);
            }catch(e){
                result=[];
                console.log("convert error!");
            }
        }
        if(typeof result!='undefined'){
            for(var i=0;i<result.length;i++){
                var code = result[i]["code"];
                var name = result[i]["name"];
                var c = new Company(self,code,name);
                self.companies.push(c);
            }
        }
        // load/initialize the portfolio after loading companies
        self.portfolio.loadItems();
    });

//    self.companies.push(new Company(self, 'APPLE','APPLE'));
//    self.companies.push(new Company(self, 'MOTO','MOTO'));
//    self.companies.push(new Company(self, 'HTC','HTC'));
//    self.companies.push(new Company(self, 'GOOGLE','GOOGLE'));
//    self.companies.push(new Company(self, 'MICROSOFT','MICROSOFT'));





    $(window).load(function () {
        var path="http://"+window.location.host;
        var socket = io.connect(path);
        //Comet
        socket.on('stock', function(msg) {
            self.updateMinDate();
            var box = document.getElementById('box');
            box.innerHTML = msg+'<br>';
            var stockCode;
            var stockList=eval(msg);
            var stockMap=stockList[0];
            for (stockCode in stockMap){
                if(typeof stockMap!='undefined'){
               var stock= stockMap[stockCode];
                var company= self.findCompany(stockCode);
                company.updateRealTimePrices(stock);
                }
            }

        });
    });

    // save portfolio when window closes
    $(window).unload(function () {
        self.portfolio.saveItems();
    });
}

// find a company from a code
ViewModel.prototype.findCompany = function (stockCode) {
    var c = this.companies;
    for (var i = 0; i < c.length; i++) {
        if (c[i].code == stockCode) {
            return c[i];
        }
    }
    return null;
}

// update chart data when min date changes
ViewModel.prototype.updateChartData = function () {

    // start with empty lists
    var seriesList = [], stylesList = [], hoverStylesList = [];

    // add series and styles to lists
    var items = this.portfolio.items();
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.chart()) {

            var series = item.company.updateChartData();
            seriesList.push(series);

            var style = { stroke: item.getColor(), 'stroke-width': 2 };
            stylesList.push(style);

            var hoverStyle = { stroke: item.getColor(), 'stroke-width': 4 };
            hoverStylesList.push(hoverStyle);
        }
    }

    // update chartVisible property
    this.chartVisible(seriesList.length > 0);

    // update chartSeries and styles
    this.chartStyles(stylesList);
    this.chartHoverStyles(hoverStylesList);
    this.chartSeries(seriesList);
}

// get color for showing amounts (positive = green, negative = red, zero = black)
ViewModel.prototype.getAmountColor = function (amount) {
    amount = amount * 1;
    return amount < 0.01 ? "#D84874" : amount > 0.01 ? "#279972" : "black";
}

// build options for jQuery auto-complete widget
ViewModel.prototype.getSymbolMatches = function (request) {

    // get terms entered by user
    var terms = request.term.toLowerCase().split(" ");

    // build options array for auto-complete
    var options = [];
    var maxItems = 12;
    for (var i = 0; i < this.companies.length && options.length < maxItems; i++) {

        // item to match: symbol plus name, lowercase
        var item = this.companies[i];
        var matchItem = (item.code + ": " + item.name).toLowerCase();
        var match = true;

        // check that all terms match
        for (var j = 0; j < terms.length && match; j++) {
            if (matchItem.indexOf(terms[j]) < 0) {
                match = false;
            }
        }

        // if all terms match, add item to result
        if (match) {

            // show matches in bold (preserving capitalization)
            var label = item.code + ":   " + item.name;
            for (var j = 0; j < terms.length; j++) {
                if (terms[j].length > 0) {
                    var rx = new RegExp(terms[j], "gi");
                    label = label.replace(rx, this.highlightMatch);
                }
            }

            // add this option to the list
            var ac = { value: item.code, label: label };
            options.push(ac);
        }
    }

    // pass result back to caller
    return options;
}

// highlight auto-complete matches by adding a 'match' span
ViewModel.prototype.highlightMatch = function (match) {
    return "<span class='match'>" + match + "</span>";
}

ViewModel.prototype.updateMinDate = function () {
    var date = new Date();
    var minute = date.getMinutes() - this.period;
    date.setMinutes(minute);
    if(this.minDate()<date){
        this.minDate(date);
    }
}


// set the starting date for the chart (between today - months and today)
ViewModel.prototype.setMinDate = function (minutes) {
    this.period=minutes;
    // calculate new starting date
    var date = new Date();
    if (minutes <= 0) {
        var year = date.getFullYear();
        var month = date.getMonth()+1;
        var day =date.getDay();
        date = new Date(year, month, day,0,0,0);
    }
    else {
        var minute = date.getMinutes() - minutes;
        date.setMinutes(minute);
    }

    // go update the data
    this.minDate(date);
}

/***********************************************************************************
 * Company class.
 * @constructor
 */
function Company(viewModel, code, name) {
    this.viewModel = viewModel;
    this.code = code;
    this.name = name;
    this.prices = ko.observable([]);
    this.chartSeries = ko.observable([]);
}

//get realTime prices fro this company
Company.prototype.updateRealTimePrices = function (stock) {
    var self = this;
    if(typeof stock!='undefined'){
            var historyPrices=self.prices();
            var day = new Date(stock["date"]);
            var price = stock["latestPrice"];
            var item = { day: day, price: price };
            historyPrices.push(item);
        // update properties
        self.prices(historyPrices);
        // update chart series data
        self.updateChartData();
    }
}

// get historical prices for this company
Company.prototype.updatePrices = function () {
    var self = this;

    // don't have prices yet? go get them now
    if (self.prices().length == 0) {

        // go get prices
        var vm = self.viewModel;
        vm.updating(vm.updating() + 1);



        $.get("/stockinfo/" + self.code, function (result) {
            // got them
            vm.updating(vm.updating() - 1);

            // parse result

            var newPrices = [];
//            var lines = result.split("\r");
//            for (var i = 0; i < lines.length; i++) {
//                var items = lines[i].split("\t");
//                if (items.length == 2) {
//                    var day = new Date($.trim(items[0]).replace(/-/g, "/"));
//                    var price = $.trim(items[1]) * 1;
//                    var item = { day: day, price: price };
//                    newPrices.push(item);
//                }
//            }
             if(typeof result=='string'){
                try{
                result= eval(result);
                }catch(e){
                    result=[];
                    console.log("convert error!");
                }
             }
             if(typeof result!='undefined'){
             for(var i=0;i<result.length;i++){
                 var day = new Date(result[i]["date"]);
                 var price = result[i]["latestPrice"];
                 var item = { day: day, price: price };
                 newPrices.push(item);
             }

            // update properties
            self.prices(newPrices);

            // update chart series data
            self.updateChartData();
             }
        });
    } else {

        // same data, different min date
        self.updateChartData();
    }
}

// update data to chart for this company
Company.prototype.updateChartData = function () {
    var xData = [], yData = [];

    // loop through prices array
    var prices = this.prices();
    for (var i = 0; i < prices.length; i++) {

        // honor min date
        if (prices[i].day < this.viewModel.minDate()) {
            //break;
            continue;
        }

        // add this point
        xData.push(prices[i].day);
        yData.push(prices[i].price);
    }
    if (xData.length == 0) {
        xData.push(0);
        yData.push(0);
    }

    // convert to percentage change from first value
    var baseValue = yData[yData.length - 1];
    for (var i = 0; i < yData.length; i++) {
        yData[i] = yData[i] / baseValue - 1;
    }

    // return x and y values
    var series = {
        data: { x: xData, y: yData },
        label: this.code,
        legendEntry: false,
        markers: { visible: false }
    };
    return series;
}

/***********************************************************************************
 * Portfolio class.
 * @constructor
 */
function Portfolio(viewModel) {
    var self = this;
    this.viewModel = viewModel;
    this.items = ko.observableArray([]);
    this.newSymbol = ko.observable("");
    this.newSymbol.subscribe(function () { self.newSymbolChanged() });
    this.canAddNewSymbol = ko.observable(false);
}

// saves the portfolio to local storage
Portfolio.prototype.saveItems = function () {
    if (localStorage != null && JSON != null) {

        // build array with items
        var items = [];
        for (var i = 0; i < this.items().length; i++) {
            var item = this.items()[i];
            var newItem = {
                code: item.code,
                chart: item.chart(),
                shares: item.shares(),
                unitCost: item.unitCost()
            };
            items.push(newItem);
        }

        // save array to local storage
        localStorage["items"] = JSON.stringify(items);
    }
}

// loads the portfolio from local storage (or initializes it with a few items)
Portfolio.prototype.loadItems = function () {

    // try loading from local storage
    var items = localStorage != null ? localStorage["items"] : null;
    if (items != null && JSON != null) {

        try {
            items = JSON.parse(items);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                this.addItem(item.code, item.chart, item.shares, item.unitCost);
            }
        }
        catch (err) {
            // ignore errors while loading...
        }
    }

    // no items? add a few now
    if (this.items().length == 0) {
        this.addItem("000001", true, 100, 200);
        this.addItem("000002", false, 100, 560);
        this.addItem("000003");
        this.addItem("000004", true, 100, 600);
        this.addItem("000005");
    }
}

// add a new item to the portfolio
Portfolio.prototype.addItem = function (code, chart, shares, unitCost) {
    var item = new PortfolioItem(this, code, chart, shares, unitCost);
    this.items.push(item);
}

// update canAddNewSymbol when newSymbol changes
Portfolio.prototype.newSymbolChanged = function () {

    // get the company that matches the newSymbol
    var newCompany = this.viewModel.findCompany(this.newSymbol());

    // no company? can't add...
    if (newCompany == null) {
        this.canAddNewSymbol(false);
        return;
    }

    // company already in portfolio? can't add
    var items = this.items();
    for (var i = 0; i < items.length; i++) {
        if (items[i].company == newCompany) {
            this.canAddNewSymbol(false);
            return;
        }
    }

    // seems OK
    this.canAddNewSymbol(true);
}

// add a new item based on the value of newSymbol
Portfolio.prototype.addNewSymbol = function () {
    var item = new PortfolioItem(this, this.newSymbol());
    this.items.push(item);
    this.canAddNewSymbol(false);
}

// remove an item from the portfolio
Portfolio.prototype.removeItem = function (item) {
    var p = item.portfolio;
    var index = p.items.indexOf(item);
    p.items.splice(index, 1);
}

/***********************************************************************************
 * PortfolioItem class.
 * @constructor
 */
function PortfolioItem(portfolio, code, chart, shares, unitCost) {
    var self = this;
    this.portfolio = portfolio;
    this.code = code;

    // observables
    this.lastPrice = ko.observable(null);
    this.change = ko.observable(null);

    // editable values
    this.chart = ko.observable(chart == null ? false : chart);
    this.chart.subscribe(function () { self.updateChartData() });
    this.shares = ko.observable(shares == null ? 0 : shares);
    this.unitCost = ko.observable(unitCost == null ? 0 : unitCost);
    this.shares.subscribe(function () { self.parametersChanged() });
    this.unitCost.subscribe(function () { self.parametersChanged() });

    // find company
    this.company = portfolio.viewModel.findCompany(code);
    if (this.company != null) {
        this.company.prices.subscribe(function () { self.pricesChanged() });
        this.pricesChanged();
        this.company.updatePrices();
    }

    // computed observables
    this.name = ko.computed(function() { return this.company.name; }, this);
    this.value = ko.computed(function () { return this.shares() * 1 == 0 || this.lastPrice() * 1 == 0 ? "" : this.lastPrice() * this.shares(); }, this);
    this.cost = ko.computed(function () { return this.shares() * 1 == 0 || this.unitCost() * 1 == 0 ? "" : this.shares() * this.unitCost(); }, this);
    this.changePercent = ko.computed(function () { return this.change() * 1 == 0 && this.lastPrice() * 1 == 0 ? "" : this.change() / this.lastPrice(); }, this);
    this.gain = ko.computed(function () { return this.cost() * 1 == 0 || this.value() * 1 == 0 ? "" : this.value() - this.cost(); }, this);
    this.gainPercent = ko.computed(function () { return this.cost() * 1 == 0 || this.value() * 1 == 0 ? "" : this.gain() / this.cost(); }, this);
    this.color = ko.computed(this.getColor, this);

    // finish initialization
    this.updateChartData();
    this.parametersChanged();
}
PortfolioItem.prototype.getColor = function () {
    var index = this.portfolio.items.indexOf(this);
    var palette = this.portfolio.viewModel.palette;
    return index > -1 ? palette[index % palette.length] : "black";
}
PortfolioItem.prototype.pricesChanged = function () {
    var prices = this.company.prices();
    if (prices.length > 1) {
        var len=prices.length;
        this.lastPrice(prices[len-1].price);
        this.change(prices[len-1].price - prices[len-2].price);
        if (this.chart()) {
            this.updateChartData();
        }
    }
}
PortfolioItem.prototype.parametersChanged = function () {
    this.shares(this.shares() * 1 == 0 ? "" : Globalize.format(this.shares() * 1, 'n2'));
    this.unitCost(this.unitCost() * 1 == 0 ? "" : Globalize.format(this.unitCost() * 1, 'n2'));
}
PortfolioItem.prototype.updateChartData = function () {
    var vm = this.portfolio.viewModel;
    vm.updateChartData();
}