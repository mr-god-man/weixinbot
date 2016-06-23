var request = require('request');
/**
 * 还不够完善,容错能力不足
 * @type {{token: string, getToken: TokenManager.getToken, _isTokenValid: TokenManager._isTokenValid, _fetchToken: TokenManager._fetchToken}}
 */
var TokenManager = {
    token:'',
    getToken:function(callback){
        this._isTokenValid((valid)=>{
            if(valid){
                callback(null,this.token);
            }else{
                this._fetchToken(()=>{
                    callback(null,this.token);
                });
            }
        });
    },
    _isTokenValid:function(callback){
        request.get('http://niu.souche.com/user/ruby/get_user',{
            qs:{
                token:this.token
            },
            json:true
        },function(r,s,body){
           console.log('get_user',body);
           if(body&&body.data&&body.data.length){
               callback(null,true);
           }else{
               callback(null,false);
           }
        });
    },
    _fetchToken:function(callback){
        request.get({
            url:'http://sso.souche-inc.com/accountApi/login.json?password=sun963&userAccount=18667046361',
            json:true
        },(e,r,body)=>{
            console.log('login',body);
            if(body.code=='200'){
                this.token = body.data;
            }
            callback(null,body.data);
        });
    }
};

module.exports = TokenManager;